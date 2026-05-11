import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { readQaSourceState } from "./qa-git.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_ROOT = path.join(ROOT_DIR, ".qa-runs");
const RELEASE_DIR = path.join(ROOT_DIR, "release");
const PACKAGED_EXE = path.join(RELEASE_DIR, "win-unpacked", "Deskagotchi.exe");
const INSTALLER_EXE = path.join(RELEASE_DIR, "Deskagotchi Setup 0.1.0.exe");
const SOURCE_RESOURCE_ROOT = path.join(ROOT_DIR, "resources");
const PACKAGED_RESOURCE_ROOT = path.join(
  RELEASE_DIR,
  "win-unpacked",
  "resources",
  "resources"
);
const REQUIRED_PETS = ["bao", "miso", "mochi", "peanut", "puddles"];
const REQUIRED_PET_FILES = ["pet.json", "spritesheet.png", "preview.png", "icon.png"];

class ReleaseRun {
  constructor() {
    const stamp = new Date()
      .toISOString()
      .replaceAll(":", "-")
      .replace(/\.\d{3}Z$/, "Z");
    this.runId = `${stamp}-release`;
    this.runDir = path.join(QA_ROOT, this.runId);
    this.report = {
      scenario: "release",
      runId: this.runId,
      startedAt: new Date().toISOString(),
      sourceState: readQaSourceState(ROOT_DIR),
      checks: [],
      artifacts: []
    };
  }

  setup() {
    fs.mkdirSync(this.runDir, { recursive: true });
    fs.writeFileSync(path.join(QA_ROOT, "latest.txt"), this.runDir, "utf8");
  }

  pass(name, details = {}) {
    this.report.checks.push({ name, status: "pass", details });
  }

  fail(name, details = {}) {
    this.report.checks.push({ name, status: "fail", details });
  }

  artifact(filename) {
    this.report.artifacts.push(filename);
  }

  finish() {
    this.report.finishedAt = new Date().toISOString();
    this.report.confidenceLabel = this.report.checks.some(
      (check) => check.status === "fail"
    )
      ? "failed"
      : "automated-pass";
    this.report.exactClaimAllowed =
      this.report.confidenceLabel === "failed"
        ? "No fixed claim allowed."
        : "packaged Windows build passed release smoke for tested scope";
    this.report.uncoveredConditions = [
      "interactive installer UI flow",
      "SmartScreen/signing reputation",
      "manual idle CPU observation",
      "startup-on-boot behavior"
    ];
    writeJson(path.join(this.runDir, "summary.json"), this.report);
    fs.writeFileSync(
      path.join(this.runDir, "report.md"),
      renderReport(this.report),
      "utf8"
    );
    fs.writeFileSync(path.join(QA_ROOT, "latest.txt"), this.runDir, "utf8");
    console.log(`Release QA report: ${path.join(this.runDir, "report.md")}`);
  }
}

function main() {
  const run = new ReleaseRun();
  run.setup();

  try {
    assertInstallerArtifacts(run);
    assertPackagedResources(run);
    runPackagedLaunchSmoke(run);
    runPackagedLifecycleSmoke(run);
    runInstallerSmoke(run);
  } catch (error) {
    run.fail("release QA threw", {
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    run.finish();
  }

  if (run.report.confidenceLabel === "failed") {
    process.exitCode = 1;
  }
}

function assertInstallerArtifacts(run) {
  assertFile(run, "Windows installer exists", INSTALLER_EXE, 50_000_000);
  assertFile(run, "packaged executable exists", PACKAGED_EXE, 1_000_000);
  assertFile(
    run,
    "installer blockmap exists",
    path.join(RELEASE_DIR, "Deskagotchi Setup 0.1.0.exe.blockmap"),
    1_000
  );
  assertFile(run, "latest release metadata exists", path.join(RELEASE_DIR, "latest.yml"), 1);
}

function assertPackagedResources(run) {
  assertDirectory(run, "packaged resource root exists", PACKAGED_RESOURCE_ROOT);
  assertFile(
    run,
    "packaged item manifest exists",
    path.join(PACKAGED_RESOURCE_ROOT, "items", "lcd-core", "items.json"),
    1
  );
  assertFile(
    run,
    "packaged item atlas exists",
    path.join(PACKAGED_RESOURCE_ROOT, "items", "lcd-core", "items.png"),
    1
  );
  assertJsonFieldMatches(
    run,
    "packaged item manifest matches source asset version",
    path.join(SOURCE_RESOURCE_ROOT, "items", "lcd-core", "items.json"),
    path.join(PACKAGED_RESOURCE_ROOT, "items", "lcd-core", "items.json"),
    "assetVersion"
  );
  assertFileMatches(
    run,
    "packaged item atlas matches source bytes",
    path.join(SOURCE_RESOURCE_ROOT, "items", "lcd-core", "items.png"),
    path.join(PACKAGED_RESOURCE_ROOT, "items", "lcd-core", "items.png")
  );

  for (const petId of REQUIRED_PETS) {
    const petDir = path.join(PACKAGED_RESOURCE_ROOT, "pets", petId);
    const sourcePetDir = path.join(SOURCE_RESOURCE_ROOT, "pets", petId);
    assertDirectory(run, `packaged pet ${petId} directory exists`, petDir);
    for (const filename of REQUIRED_PET_FILES) {
      assertFile(
        run,
        `packaged pet ${petId} includes ${filename}`,
        path.join(petDir, filename),
        1
      );
      assertFileMatches(
        run,
        `packaged pet ${petId} ${filename} matches source bytes`,
        path.join(sourcePetDir, filename),
        path.join(petDir, filename)
      );
    }
  }

  const docsPath = path.join(RELEASE_DIR, "win-unpacked", "resources", "docs");
  if (fs.existsSync(docsPath)) {
    run.fail("packaged app excludes docs QA artifacts", { docsPath });
  } else {
    run.pass("packaged app excludes docs QA artifacts");
  }
}

function runPackagedLaunchSmoke(run) {
  const result = runDesktopScenarioSmoke(run, PACKAGED_EXE, "launch");
  if (result.status === 0) {
    run.pass("packaged executable launches with isolated QA profile", {
      report: result.relativeReport
    });
    if (
      result.metadata.isPackaged === true &&
      typeof result.metadata.appPath === "string" &&
      result.metadata.appPath.includes("release") &&
      result.metadata.appPath.endsWith("app.asar")
    ) {
      run.pass("packaged launch metadata confirms app.asar runtime", {
        appPath: result.metadata.appPath,
        resourcesPath: result.metadata.resourcesPath
      });
    } else {
      run.fail("packaged launch metadata confirms app.asar runtime", result.metadata);
    }
    return;
  }
  run.fail("packaged executable launches with isolated QA profile", {
    status: result.status,
    report: result.relativeReport
  });
}

function runPackagedLifecycleSmoke(run) {
  const result = runDesktopScenarioSmoke(run, PACKAGED_EXE, "lifecycle");
  if (result.status === 0) {
    run.pass("packaged executable passes lifecycle recovery smoke", {
      report: result.relativeReport
    });
    return;
  }

  run.fail("packaged executable passes lifecycle recovery smoke", {
    status: result.status,
    report: result.relativeReport
  });
}

function runInstallerSmoke(run) {
  if (process.platform !== "win32") {
    run.fail("silent installer smoke is Windows-only", { platform: process.platform });
    return;
  }

  const installDir = path.join(run.runDir, "install-target");
  fs.rmSync(installDir, { recursive: true, force: true });
  fs.mkdirSync(installDir, { recursive: true });

  const installResult = spawnSync(INSTALLER_EXE, ["/S", `/D=${installDir}`], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    timeout: 120_000
  });
  writeCommandLog(run, "installer-install.log", installResult);
  run.artifact("installer-install.log");
  if (installResult.status !== 0) {
    run.fail("silent installer completed", {
      status: installResult.status,
      signal: installResult.signal
    });
    return;
  }
  run.pass("silent installer completed", { installDir });

  const installedExe = path.join(installDir, "Deskagotchi.exe");
  assertFile(run, "silent installer created installed executable", installedExe, 1_000_000);

  const installedLaunch = runDesktopScenarioSmoke(run, installedExe, "launch");
  if (installedLaunch.status === 0) {
    run.pass("installed executable launches with isolated QA profile", {
      report: installedLaunch.relativeReport
    });
  } else {
    run.fail("installed executable launches with isolated QA profile", {
      status: installedLaunch.status,
      report: installedLaunch.relativeReport
    });
  }

  const uninstallerPath = findUninstaller(installDir);
  if (uninstallerPath === undefined) {
    run.fail("silent installer created uninstaller", { installDir });
    return;
  }
  run.pass("silent installer created uninstaller", {
    path: path.relative(ROOT_DIR, uninstallerPath)
  });

  const uninstallResult = spawnSync(uninstallerPath, ["/S"], {
    cwd: installDir,
    encoding: "utf8",
    timeout: 120_000
  });
  writeCommandLog(run, "installer-uninstall.log", uninstallResult);
  run.artifact("installer-uninstall.log");
  if (uninstallResult.status !== 0) {
    run.fail("silent uninstaller completed", {
      status: uninstallResult.status,
      signal: uninstallResult.signal
    });
    return;
  }
  run.pass("silent uninstaller completed");

  if (waitForPathMissing(installedExe, 15_000)) {
    run.pass("silent uninstaller removed installed executable");
  } else {
    run.fail("silent uninstaller removed installed executable", { installedExe });
  }

  cleanupDirectoryWithRetry(installDir);
}

function runDesktopScenarioSmoke(run, executablePath, scenario) {
  const startedAtMs = Date.now();
  const child = spawnSync(process.execPath, ["scripts/qa/desktop-qa.mjs", scenario], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: {
      ...process.env,
      DESKAGOTCHI_QA_EXECUTABLE_PATH: executablePath,
      DESKAGOTCHI_QA_SKIP_BUILD: "1"
    }
  });
  const latestRunDir = readLatestScenarioRunDir(scenario, startedAtMs);
  const reportPath = latestRunDir === null ? null : path.join(latestRunDir, "report.md");
  const relativeReport =
    reportPath === null ? "not recorded" : path.relative(ROOT_DIR, reportPath);
  if (reportPath !== null) {
    run.artifact(relativeReport);
  }

  const startupInvariantsPath =
    latestRunDir === null ? null : path.join(latestRunDir, "startup-invariants.json");
  const metadata =
    scenario === "launch" && startupInvariantsPath !== null
      ? readJson(startupInvariantsPath) ?? {}
      : {};
  if (scenario === "launch" && startupInvariantsPath !== null) {
    run.artifact(path.relative(ROOT_DIR, startupInvariantsPath));
  }

  return {
    status: child.status,
    relativeReport,
    metadata
  };
}

function readLatestScenarioRunDir(scenario, startedAtMs) {
  const latestPath = path.join(QA_ROOT, "latest.txt");
  if (!fs.existsSync(latestPath)) {
    return null;
  }
  const latestRunDir = fs.readFileSync(latestPath, "utf8").trim();
  if (latestRunDir.endsWith(`-${scenario}`) && fs.existsSync(latestRunDir)) {
    return latestRunDir;
  }

  const latestMatchingRun = fs
    .readdirSync(QA_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(`-${scenario}`))
    .map((entry) => path.join(QA_ROOT, entry.name))
    .filter((runDir) => fs.statSync(runDir).mtimeMs >= startedAtMs - 2_000)
    .sort((left, right) => right.localeCompare(left))[0];
  return latestMatchingRun ?? null;
}

function assertFile(run, name, filePath, minBytes) {
  if (!fs.existsSync(filePath)) {
    run.fail(name, { path: filePath, reason: "missing" });
    return;
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size < minBytes) {
    run.fail(name, { path: filePath, size: stat.size, minBytes });
    return;
  }
  run.pass(name, {
    path: path.relative(ROOT_DIR, filePath),
    size: stat.size
  });
}

function assertDirectory(run, name, directoryPath) {
  if (fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory()) {
    run.pass(name, { path: path.relative(ROOT_DIR, directoryPath) });
    return;
  }
  run.fail(name, { path: directoryPath });
}

function assertJsonFieldMatches(run, name, sourcePath, packagedPath, fieldName) {
  const sourceJson = readJson(sourcePath);
  const packagedJson = readJson(packagedPath);
  const sourceValue = sourceJson?.[fieldName];
  const packagedValue = packagedJson?.[fieldName];
  if (
    typeof sourceValue === "string" &&
    typeof packagedValue === "string" &&
    sourceValue === packagedValue
  ) {
    run.pass(name, { [fieldName]: packagedValue });
    return;
  }

  run.fail(name, {
    sourcePath: path.relative(ROOT_DIR, sourcePath),
    packagedPath: path.relative(ROOT_DIR, packagedPath),
    sourceValue,
    packagedValue
  });
}

function assertFileMatches(run, name, sourcePath, packagedPath) {
  if (!fs.existsSync(sourcePath) || !fs.existsSync(packagedPath)) {
    run.fail(name, {
      sourcePath: path.relative(ROOT_DIR, sourcePath),
      packagedPath: path.relative(ROOT_DIR, packagedPath),
      reason: "missing file"
    });
    return;
  }

  const sourceBytes = fs.readFileSync(sourcePath);
  const packagedBytes = fs.readFileSync(packagedPath);
  if (sourceBytes.equals(packagedBytes)) {
    run.pass(name, {
      path: path.relative(ROOT_DIR, packagedPath),
      size: packagedBytes.length
    });
    return;
  }

  run.fail(name, {
    sourcePath: path.relative(ROOT_DIR, sourcePath),
    packagedPath: path.relative(ROOT_DIR, packagedPath),
    sourceSize: sourceBytes.length,
    packagedSize: packagedBytes.length
  });
}

function findUninstaller(installDir) {
  const entries = fs.readdirSync(installDir, { withFileTypes: true });
  const uninstaller = entries.find(
    (entry) =>
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".exe") &&
      entry.name.toLowerCase().includes("uninstall")
  );
  return uninstaller === undefined ? undefined : path.join(installDir, uninstaller.name);
}

function writeCommandLog(run, filename, result) {
  fs.writeFileSync(
    path.join(run.runDir, filename),
    [
      `status=${result.status ?? ""}`,
      `signal=${result.signal ?? ""}`,
      "stdout:",
      result.stdout ?? "",
      "stderr:",
      result.stderr ?? ""
    ].join("\n"),
    "utf8"
  );
}

function waitForPathMissing(targetPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!fs.existsSync(targetPath)) {
      return true;
    }
    sleepSync(250);
  }
  return !fs.existsSync(targetPath);
}

function cleanupDirectoryWithRetry(directoryPath) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      fs.rmSync(directoryPath, { recursive: true, force: true });
      if (!fs.existsSync(directoryPath)) {
        return;
      }
    } catch (error) {
      if (!isRetryableFilesystemError(error)) {
        throw error;
      }
    }
    sleepSync(250);
  }
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

function isRetryableFilesystemError(error) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "EPERM" || error.code === "EACCES" || error.code === "EBUSY")
  );
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function renderReport(report) {
  const checks = report.checks
    .map((check) => `- ${check.status === "pass" ? "PASS" : "FAIL"}: ${check.name}`)
    .join("\n");
  const artifacts = report.artifacts.map((artifact) => `- ${artifact}`).join("\n");
  const uncovered = report.uncoveredConditions
    .map((condition) => `- ${condition}`)
    .join("\n");
  return `# Deskagotchi Release QA Report

Scenario: ${report.scenario}
Run ID: ${report.runId}
Confidence: ${report.confidenceLabel}
Platform: ${process.platform} ${os.release()}
Exact claim allowed: ${report.exactClaimAllowed}

## Checks

${checks || "- No checks recorded."}

## Artifacts

${artifacts || "- No artifacts recorded."}

## Uncovered Conditions

${uncovered || "- None listed."}
`;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

main();
