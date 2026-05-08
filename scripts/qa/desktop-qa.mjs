import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { _electron as electron } from "playwright";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_ROOT = path.join(ROOT_DIR, ".qa-runs");
const MAIN_ENTRY = path.join(ROOT_DIR, "out/main/index.js");
const SCENARIO = process.argv[2] ?? "launch";
const IS_WINDOWS = process.platform === "win32";
const DRAG_DELTA_DIP = 72;
const DRAG_TOLERANCE_DIP = 14;

class QaRun {
  constructor(scenario) {
    const stamp = new Date()
      .toISOString()
      .replaceAll(":", "-")
      .replace(/\.\d{3}Z$/, "Z");
    this.scenario = scenario;
    this.runId = `${stamp}-${scenario}`;
    this.runDir = path.join(QA_ROOT, this.runId);
    this.profileDir = path.join(this.runDir, "profile");
    this.report = {
      scenario,
      runId: this.runId,
      startedAt: new Date().toISOString(),
      confidenceLabel: "failed",
      evidenceTier: "electron-internal",
      checks: [],
      artifacts: []
    };
  }

  setup() {
    fs.mkdirSync(this.runDir, { recursive: true });
    fs.mkdirSync(this.profileDir, { recursive: true });
    writeJson(path.join(this.runDir, "harness-metadata.json"), {
      runId: this.runId,
      scenario: this.scenario,
      rootDir: ROOT_DIR,
      runDir: this.runDir,
      profileDir: this.profileDir,
      platform: process.platform,
      release: os.release()
    });
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

  finish(label, extra = {}) {
    this.report.finishedAt = new Date().toISOString();
    this.report.confidenceLabel = label;
    Object.assign(this.report, extra);
    writeJson(path.join(this.runDir, "summary.json"), this.report);
    fs.writeFileSync(path.join(this.runDir, "report.md"), renderReport(this.report), "utf8");
    console.log(`QA report: ${path.join(this.runDir, "report.md")}`);
  }
}

async function main() {
  const run = new QaRun(SCENARIO);
  run.setup();

  try {
    ensureBuild();
    cleanupOrphanedQaProcesses(run);
    await assertNoExistingDeskagotchi(run);
    const app = await launchApp(run);
    try {
      await routeScenario(run, app);
      const label =
        run.report.checks.some((check) => check.status === "fail")
          ? "failed"
          : scenarioConfidenceLabel(run);
      run.finish(label, {
        exactClaimAllowed: exactClaimFor(run, label),
        uncoveredConditions: uncoveredConditionsFor(run)
      });
      process.exitCode = label === "failed" ? 1 : 0;
    } finally {
      await closeApp(app, run);
    }
  } catch (error) {
    run.fail("scenario threw", {
      message: error instanceof Error ? error.message : String(error)
    });
    run.finish("failed", {
      exactClaimAllowed: "No fixed claim allowed.",
      uncoveredConditions: uncoveredConditionsFor(run)
    });
    process.exitCode = 1;
  }
}

async function routeScenario(run, app) {
  switch (run.scenario) {
    case "launch":
      await runLaunchScenario(run, app);
      return;
    case "drag":
      await runDragScenario(run, app);
      return;
    case "overlay":
      await runOverlayScenario(run, app);
      return;
    case "play":
      await runPlayScenario(run, app);
      return;
    case "lifecycle":
      await runLifecycleScenario(run, app);
      return;
    case "renderer":
      await runRendererScenario(run, app);
      return;
    default:
      throw new Error(`Unknown QA scenario '${run.scenario}'.`);
  }
}

function ensureBuild() {
  if (process.env.DESKAGOTCHI_QA_SKIP_BUILD === "1" && fs.existsSync(MAIN_ENTRY)) {
    return;
  }
  runCommand("npm.cmd", ["run", "build"], { cwd: ROOT_DIR });
}

async function launchApp(run) {
  const app = await electron.launch({
    args: [ROOT_DIR],
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DESKAGOTCHI_QA: "1",
      DESKAGOTCHI_QA_RUN_ID: run.runId,
      DESKAGOTCHI_QA_RUN_DIR: run.runDir,
      DESKAGOTCHI_QA_USER_DATA_DIR: run.profileDir
    }
  });

  const processInfo = app.process();
  run.pass("electron launched", {
    pid: processInfo.pid
  });
  const page = await app.firstWindow({ timeout: 30_000 });
  page.on("console", (message) => {
    appendLog(run, `[renderer:${message.type()}] ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    appendLog(run, `[renderer:error] ${error.message}`);
  });
  await page.waitForSelector("[data-testid='pet-sprite']", { timeout: 30_000 });
  run.pass("overlay rendered pet sprite");
  return app;
}

async function runLaunchScenario(run, app) {
  const page = await overlayPage(app);
  await page.screenshot({ path: path.join(run.runDir, "launch-overlay.png") });
  run.artifact("launch-overlay.png");
  const metadata = await collectElectronMetadata(app);
  writeJson(path.join(run.runDir, "startup-invariants.json"), metadata);
  run.artifact("startup-invariants.json");
  validateStartupInvariants(run, metadata);
}

async function runDragScenario(run, app) {
  const page = await overlayPage(app);
  const before = await getOverlayWindowInfo(app);
  writeJson(path.join(run.runDir, "bounds-before.json"), before);
  run.artifact("bounds-before.json");
  await page.screenshot({ path: path.join(run.runDir, "before.png") });
  run.artifact("before.png");

  await page.locator("[data-testid='pet-sprite']").click();
  await page.waitForSelector("[data-testid='overlay-actions']", { timeout: 5_000 });
  run.pass("click without movement opened care menu");
  await page.locator("[data-testid='pet-sprite']").click();
  await page.waitForSelector("[data-testid='overlay-actions']", {
    state: "hidden",
    timeout: 5_000
  });
  run.pass("click without movement closed care menu");

  const start = await pointForPetSpriteCenter(page, before);
  const end = {
    x: start.x + Math.round(DRAG_DELTA_DIP * before.display.scaleFactor),
    y: start.y
  };

  await takeDesktopScreenshot(run, "desktop-before.png");
  await performOsDrag(start, end);
  await page.waitForTimeout(900);
  await takeDesktopScreenshot(run, "desktop-after.png");
  run.artifact("desktop-before.png");
  run.artifact("desktop-after.png");

  const after = await getOverlayWindowInfo(app);
  writeJson(path.join(run.runDir, "bounds-after.json"), after);
  run.artifact("bounds-after.json");
  await page.screenshot({ path: path.join(run.runDir, "after.png") });
  run.artifact("after.png");

  const delta = {
    x: after.bounds.x - before.bounds.x,
    y: after.bounds.y - before.bounds.y
  };
  const dragPassed =
    Math.abs(delta.x - DRAG_DELTA_DIP) <= DRAG_TOLERANCE_DIP &&
    Math.abs(delta.y) <= DRAG_TOLERANCE_DIP;
  if (dragPassed) {
    run.pass("OS drag moved native overlay bounds", { delta });
  } else {
    run.fail("OS drag moved native overlay bounds", {
      expected: { x: DRAG_DELTA_DIP, y: 0 },
      tolerance: DRAG_TOLERANCE_DIP,
      actual: delta
    });
  }

  const menuVisibleAfterDrag = await page
    .locator("[data-testid='overlay-actions']")
    .isVisible()
    .catch(() => false);
  if (menuVisibleAfterDrag) {
    run.fail("drag did not leave care menu closed");
  } else {
    run.pass("drag did not leave care menu closed");
  }

  await waitForPersistedBounds(run, after.bounds);
  await closeApp(app, run);
  const relaunched = await launchApp(run);
  try {
    const restored = await getOverlayWindowInfo(relaunched);
    writeJson(path.join(run.runDir, "bounds-restored.json"), restored);
    run.artifact("bounds-restored.json");
    const restoredPassed =
      Math.abs(restored.bounds.x - after.bounds.x) <= DRAG_TOLERANCE_DIP &&
      Math.abs(restored.bounds.y - after.bounds.y) <= DRAG_TOLERANCE_DIP;
    if (restoredPassed) {
      run.pass("relaunch restored persisted pet position", {
        restored: restored.bounds
      });
    } else {
      run.fail("relaunch restored persisted pet position", {
        expected: after.bounds,
        actual: restored.bounds
      });
    }
  } finally {
    await closeApp(relaunched, run);
  }

  run.report.evidenceTier = "os-desktop";
}

async function runOverlayScenario(run, app) {
  const page = await overlayPage(app);
  await page.locator("[data-testid='pet-sprite']").click();
  await page.waitForSelector("[data-testid='overlay-actions']", { timeout: 5_000 });
  run.pass("overlay menu opened");
  await page.screenshot({ path: path.join(run.runDir, "overlay-menu.png") });
  run.artifact("overlay-menu.png");

  for (const title of ["Feed", "Play", "Clean", "Sleep", "Med", "Health"]) {
    const count = await page.locator(`button[title='${title}']`).count();
    count > 0 ? run.pass(`menu includes ${title}`) : run.fail(`menu includes ${title}`);
  }
  await assertOverlayActionLabelsFit(run, page);
  await assertPetIsNotCovered(run, page, "[data-testid='overlay-actions']", "action menu");

  await page.locator("button[title='Feed']").click();
  await page.waitForSelector("[data-testid='overlay-feed-picker']", { timeout: 5_000 });
  const feedItemCount = await page.locator("[data-testid='overlay-feed-item']").count();
  feedItemCount > 0 && feedItemCount <= 6
    ? run.pass("feed picker shows scoped food choices", { feedItemCount })
    : run.fail("feed picker shows scoped food choices", { feedItemCount });
  const feedPickerText = await page.locator("[data-testid='overlay-feed-picker']").innerText();
  const clutterWords = feedPickerText.match(/\b(favorite|likes|pantry)\b/gi) ?? [];
  clutterWords.length === 0
    ? run.pass("feed picker avoids visible preference labels")
    : run.fail("feed picker avoids visible preference labels", { clutterWords });
  await page.screenshot({ path: path.join(run.runDir, "overlay-feed.png") });
  run.artifact("overlay-feed.png");
  await assertPetIsNotCovered(
    run,
    page,
    "[data-testid='overlay-feed-picker']",
    "feed picker"
  );
  await selectFoodAndAssertCue(run, page, page.locator("[data-testid='overlay-feed-item']").first(), "meal");
  await page.screenshot({ path: path.join(run.runDir, "overlay-eating.png") });
  run.artifact("overlay-eating.png");

  await page.locator("[data-testid='pet-sprite']").click();
  await page.waitForSelector("[data-testid='overlay-actions']", { timeout: 5_000 });
  await page.locator("button[title='Feed']").click();
  await page.waitForSelector("[data-testid='overlay-feed-picker']", { timeout: 5_000 });
  await page.getByRole("tab", { name: "Snack" }).click();
  await selectFoodAndAssertCue(run, page, page.locator("[data-testid='overlay-feed-item']").first(), "snack");

  await page.locator("[data-testid='pet-sprite']").click();
  await page.waitForSelector("[data-testid='overlay-actions']", { timeout: 5_000 });

  await page.locator("button[title='Health']").click();
  await page.waitForSelector("[data-testid='overlay-health-card']", { timeout: 5_000 });
  run.pass("health opens compact overlay card");
  await page.screenshot({ path: path.join(run.runDir, "overlay-health.png") });
  run.artifact("overlay-health.png");
  await assertPetIsNotCovered(
    run,
    page,
    "[data-testid='overlay-health-card']",
    "health card"
  );
  const windows = await app.windows();
  windows.length === 1
    ? run.pass("overlay health did not open a panel window")
    : run.fail("overlay health did not open a panel window", { windowCount: windows.length });
}

async function selectFoodAndAssertCue(run, page, foodLocator, label) {
  const expectedIconId = await foodLocator.getAttribute("data-icon-id");
  const expectedItemId = await foodLocator.getAttribute("data-item-id");
  await foodLocator.click();
  const foodCue = page.locator(
    `[data-testid='pet-food-cue'][data-icon-id='${expectedIconId}'][data-item-id='${expectedItemId}']`
  );
  await foodCue.waitFor({ timeout: 5_000 });
  const actualIconId = await foodCue.getAttribute("data-icon-id");
  const actualItemId = await foodCue.getAttribute("data-item-id");
  if (actualIconId === expectedIconId && actualItemId === expectedItemId) {
    run.pass(`${label} eating feedback uses selected food cue`, {
      iconId: actualIconId,
      itemId: actualItemId
    });
    return;
  }
  run.fail(`${label} eating feedback uses selected food cue`, {
    expectedIconId,
    expectedItemId,
    actualIconId,
    actualItemId
  });
}

async function runPlayScenario(run, app) {
  const page = await overlayPage(app);
  const before = await getOverlayWindowInfo(app);
  await page.locator("[data-testid='pet-sprite']").click();
  await page.locator("button[title='Play']").click();
  await page.getByText("Ball").click();
  await page.waitForSelector("[data-testid='overlay-play-stage']", { timeout: 5_000 });
  await page.waitForTimeout(500);
  const playBounds = await getOverlayWindowInfo(app);
  const expanded =
    playBounds.bounds.width > before.bounds.width &&
    playBounds.bounds.height > before.bounds.height;
  expanded
    ? run.pass("play mode expanded overlay bounds", {
        before: before.bounds,
        play: playBounds.bounds
      })
    : run.fail("play mode expanded overlay bounds", {
        before: before.bounds,
        play: playBounds.bounds
      });
  await page.screenshot({ path: path.join(run.runDir, "play-stage.png") });
  run.artifact("play-stage.png");
  await assertPlaySurfaceLooksUsable(run, page);
  await page.locator("[data-testid='overlay-play-close']").click();
  await page.waitForSelector("[data-testid='pet-sprite']", { timeout: 5_000 });
  const restored = await getOverlayWindowInfo(app);
  const restoredPassed =
    Math.abs(restored.bounds.width - before.bounds.width) <= 4 &&
    Math.abs(restored.bounds.height - before.bounds.height) <= 4;
  restoredPassed
    ? run.pass("play exit restored compact overlay size", { restored: restored.bounds })
    : run.fail("play exit restored compact overlay size", { restored: restored.bounds });
}

async function assertPetIsNotCovered(run, page, overlaySelector, label) {
  const metrics = await page.evaluate((selector) => {
    const pet = globalThis.document.querySelector("[data-testid='pet-sprite']");
    const overlay = globalThis.document.querySelector(selector);
    const rectFor = (element) => {
      const rect = element?.getBoundingClientRect();
      return rect === undefined
        ? undefined
        : {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width
          };
    };
    const petRect = rectFor(pet);
    const overlayRect = rectFor(overlay);
    if (petRect === undefined || overlayRect === undefined) {
      return { petRect, overlayRect, overlapRatio: 1 };
    }
    const overlapWidth = Math.max(
      0,
      Math.min(petRect.right, overlayRect.right) - Math.max(petRect.left, overlayRect.left)
    );
    const overlapHeight = Math.max(
      0,
      Math.min(petRect.bottom, overlayRect.bottom) - Math.max(petRect.top, overlayRect.top)
    );
    const petArea = Math.max(1, petRect.width * petRect.height);
    return {
      petRect,
      overlayRect,
      overlapRatio: (overlapWidth * overlapHeight) / petArea
    };
  }, overlaySelector);

  const petVisible =
    metrics.petRect !== undefined &&
    metrics.overlayRect !== undefined &&
    metrics.overlapRatio <= 0.18;
  petVisible
    ? run.pass(`${label} keeps pet visible`, metrics)
    : run.fail(`${label} keeps pet visible`, metrics);
}

async function assertOverlayActionLabelsFit(run, page) {
  const labelMetrics = await page.evaluate(() =>
    Array.from(globalThis.document.querySelectorAll(".overlay-action-button")).map((button) => {
      const label = button.getAttribute("data-action-label") ?? button.textContent ?? "";
      const span = button.querySelector(".overlay-action-label");
      const spanRect = span?.getBoundingClientRect();
      const spanStyle = span === null ? undefined : globalThis.getComputedStyle(span);
      return {
        label,
        accessibleLabel: button.getAttribute("aria-label") ?? "",
        buttonClientWidth: button.clientWidth,
        buttonScrollWidth: button.scrollWidth,
        hiddenLabel:
          spanStyle?.position === "absolute" &&
          (spanRect?.width ?? 0) <= 1 &&
          (spanRect?.height ?? 0) <= 1,
        spanClientWidth: span?.clientWidth ?? 0,
        spanScrollWidth: span?.scrollWidth ?? 0
      };
    })
  );
  const clippedLabels = labelMetrics.filter(
    (metric) =>
      metric.hiddenLabel !== true &&
      (metric.buttonScrollWidth > metric.buttonClientWidth + 1 ||
        metric.spanScrollWidth > metric.spanClientWidth + 1)
  );
  const unlabeledButtons = labelMetrics.filter(
    (metric) => metric.accessibleLabel.trim().length === 0
  );
  if (clippedLabels.length === 0 && unlabeledButtons.length === 0) {
    run.pass("overlay action buttons avoid visible label truncation", { labelMetrics });
    return;
  }
  run.fail("overlay action buttons avoid visible label truncation", {
    clippedLabels,
    unlabeledButtons
  });
}

async function assertPlaySurfaceLooksUsable(run, page) {
  const metrics = await page.evaluate(() => {
    const stage = globalThis.document.querySelector("[data-testid='overlay-play-stage']");
    const close = globalThis.document.querySelector("[data-testid='overlay-play-close']");
    const ball = globalThis.document.querySelector("[data-testid='overlay-play-ball']");
    const pet = globalThis.document.querySelector(".overlay-play-pet .pet-sprite");
    const rectFor = (element) => {
      const rect = element?.getBoundingClientRect();
      return rect === undefined
        ? undefined
        : {
            width: rect.width,
            height: rect.height
          };
    };
    const stageStyle = stage === null ? undefined : globalThis.getComputedStyle(stage);
    return {
      stageBackground: stageStyle?.backgroundColor,
      stageBorderTopWidth: stageStyle?.borderTopWidth,
      closeRect: rectFor(close),
      ballRect: rectFor(ball),
      petRect: rectFor(pet)
    };
  });

  const stageIsTransparent =
    metrics.stageBackground === "rgba(0, 0, 0, 0)" &&
    metrics.stageBorderTopWidth === "0px";
  stageIsTransparent
    ? run.pass("play stage has no visible boundary", metrics)
    : run.fail("play stage has no visible boundary", metrics);

  const controlsAreLargeEnough =
    (metrics.closeRect?.width ?? 0) >= 40 &&
    (metrics.closeRect?.height ?? 0) >= 40 &&
    (metrics.ballRect?.width ?? 0) >= 36 &&
    (metrics.ballRect?.height ?? 0) >= 36 &&
    (metrics.petRect?.width ?? 0) >= 88 &&
    (metrics.petRect?.height ?? 0) >= 88;
  controlsAreLargeEnough
    ? run.pass("play controls and sprites are desktop-readable", metrics)
    : run.fail("play controls and sprites are desktop-readable", metrics);
}

async function runLifecycleScenario(run, app) {
  const page = await overlayPage(app);
  await page.evaluate(() => globalThis.deskagotchi.openPanel("status"));
  await app.waitForEvent("window", { timeout: 5_000 });
  const windows = await app.windows();
  windows.length >= 2
    ? run.pass("panel opened from preload bridge", { windowCount: windows.length })
    : run.fail("panel opened from preload bridge", { windowCount: windows.length });
  await page.evaluate(() => globalThis.deskagotchi.resetPetWindow());
  await page.waitForTimeout(400);
  const reset = await getOverlayWindowInfo(app);
  run.pass("reset position command returned", { bounds: reset.bounds });
}

async function runRendererScenario(run, app) {
  const page = await overlayPage(app);
  const views = ["status", "pet-selector", "hatch", "settings"];
  for (const view of views) {
    const previousWindows = await app.windows();
    await page.evaluate(
      (panelView) => globalThis.deskagotchi.openPanel(panelView),
      view
    );
    const panelPage =
      previousWindows.length === 1
        ? await app.waitForEvent("window", { timeout: 5_000 })
        : (await app.windows()).find((candidate) => candidate !== page);
    if (panelPage === undefined) {
      run.fail(`panel route ${view} opened`);
      continue;
    }
    await panelPage.waitForLoadState("domcontentloaded");
    await panelPage.screenshot({ path: path.join(run.runDir, `panel-${view}.png`) });
    run.artifact(`panel-${view}.png`);
    run.pass(`panel route ${view} rendered`);
  }
}

async function overlayPage(app) {
  const pages = await app.windows();
  const page = pages.find((candidate) => candidate.url().includes("#/overlay")) ?? pages[0];
  await page.waitForSelector("[data-testid='pet-sprite']", { timeout: 30_000 });
  return page;
}

async function getOverlayWindowInfo(app) {
  return app.evaluate(({ BrowserWindow, screen }) => {
    const windows = BrowserWindow.getAllWindows();
    const window = windows.find((candidate) => candidate.webContents.getURL().includes("#/overlay"));
    if (window === undefined) {
      throw new Error("Overlay window was not found.");
    }
    const bounds = window.getBounds();
    const display = screen.getDisplayMatching(bounds);
    return {
      bounds,
      url: window.webContents.getURL(),
      display: {
        id: String(display.id),
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor
      }
    };
  });
}

async function collectElectronMetadata(app) {
  return app.evaluate(({ BrowserWindow, app, screen }) => ({
    appVersion: app.getVersion(),
    userDataPath: app.getPath("userData"),
    savePath: `${app.getPath("userData")}\\deskagotchi-save.json`,
    windows: BrowserWindow.getAllWindows().map((window) => ({
      title: window.getTitle(),
      bounds: window.getBounds(),
      visible: window.isVisible(),
      url: window.webContents.getURL()
    })),
    displays: screen.getAllDisplays().map((display) => ({
      id: String(display.id),
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor
    }))
  }));
}

function validateStartupInvariants(run, metadata) {
  const profileInsideRun = metadata.userDataPath.startsWith(run.profileDir);
  profileInsideRun
    ? run.pass("userData path is isolated", { userDataPath: metadata.userDataPath })
    : run.fail("userData path is isolated", {
        expectedPrefix: run.profileDir,
        actual: metadata.userDataPath
      });

  const overlayWindow = metadata.windows.find((window) => window.url.includes("#/overlay"));
  overlayWindow !== undefined
    ? run.pass("overlay window role detected", { bounds: overlayWindow.bounds })
    : run.fail("overlay window role detected", { windows: metadata.windows });
}

async function pointForPetSpriteCenter(page, info) {
  const spriteCenter = await page.locator("[data-testid='pet-sprite']").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  });
  const scaleFactor = info.display.scaleFactor;
  return {
    x: Math.round((info.bounds.x + spriteCenter.x) * scaleFactor),
    y: Math.round((info.bounds.y + spriteCenter.y) * scaleFactor)
  };
}

async function performOsDrag(start, end) {
  if (!IS_WINDOWS) {
    throw new Error("OS drag QA is currently implemented for Windows only.");
  }
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class DeskagotchiMouse {
  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")]
  public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);
}
"@
[DeskagotchiMouse]::SetCursorPos(${start.x}, ${start.y}) | Out-Null
Start-Sleep -Milliseconds 120
[DeskagotchiMouse]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 120
for ($step = 1; $step -le 8; $step++) {
  $x = [Math]::Round(${start.x} + ((${end.x} - ${start.x}) * $step / 8))
  $y = [Math]::Round(${start.y} + ((${end.y} - ${start.y}) * $step / 8))
  [DeskagotchiMouse]::SetCursorPos($x, $y) | Out-Null
  Start-Sleep -Milliseconds 45
}
[DeskagotchiMouse]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
`;
  runPowerShell(script);
}

async function takeDesktopScreenshot(run, filename) {
  if (!IS_WINDOWS) {
    return;
  }
  const screenshotPath = path.join(run.runDir, filename);
  const escapedPath = screenshotPath.replaceAll("'", "''");
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bitmap.Size)
$bitmap.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
`;
  runPowerShell(script);
}

async function waitForPersistedBounds(run, expectedBounds) {
  const savePath = path.join(run.profileDir, "deskagotchi-save.json");
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (fs.existsSync(savePath)) {
      const save = JSON.parse(fs.readFileSync(savePath, "utf8"));
      const persisted = save.settings?.petWindowBounds;
      if (
        persisted !== undefined &&
        Math.abs(persisted.x - expectedBounds.x) <= DRAG_TOLERANCE_DIP &&
        Math.abs(persisted.y - expectedBounds.y) <= DRAG_TOLERANCE_DIP
      ) {
        run.pass("drag bounds persisted to QA save", { persisted });
        return;
      }
    }
    await delay(250);
  }
  run.fail("drag bounds persisted to QA save", {
    expected: expectedBounds,
    savePath
  });
}

async function assertNoExistingDeskagotchi(run) {
  if (!IS_WINDOWS || process.env.DESKAGOTCHI_QA_ALLOW_EXISTING === "1") {
    return;
  }
  const script = `
$self = ${process.pid}
Get-CimInstance Win32_Process |
  Where-Object {
    $_.ProcessId -ne $self -and
    $_.CommandLine -and
    ($_.CommandLine -like '*deskagotchi*') -and
    ($_.CommandLine -notlike '*.qa-runs*') -and
    ($_.CommandLine -notlike '*scripts/qa/*') -and
    ($_.CommandLine -notlike '*scripts\\qa\\*') -and
    ($_.CommandLine -notlike '*scripts/qa/desktop-qa.mjs*') -and
    ($_.CommandLine -notlike '*scripts\\qa\\desktop-qa.mjs*') -and
    ($_.CommandLine -notlike '*qa:desktop*') -and
    ($_.CommandLine -notlike '*qa:renderer*') -and
    ($_.CommandLine -notlike '*npm.cmd run qa*')
  } |
  Select-Object ProcessId, Name, CommandLine |
  ConvertTo-Json -Compress
`;
  const result = runPowerShell(script, { allowFailure: true }).trim();
  if (result.length === 0) {
    run.pass("no existing non-QA Deskagotchi process detected");
    return;
  }
  throw new Error(`Existing Deskagotchi-like process detected: ${result}`);
}

function cleanupOrphanedQaProcesses(run) {
  if (!IS_WINDOWS) {
    return;
  }
  const qaRoot = QA_ROOT.replaceAll("'", "''");
  const script = `
$qaRoot = '${qaRoot}'
$processes = Get-CimInstance Win32_Process |
  Where-Object {
    $_.CommandLine -and
    ($_.Name -eq 'electron.exe') -and
    ($_.CommandLine -like "*$qaRoot*")
  }
$count = @($processes).Count
$processes | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 800
Get-CimInstance Win32_Process |
  Where-Object {
    $_.CommandLine -and
    ($_.Name -eq 'electron.exe') -and
    ($_.CommandLine -like "*$qaRoot*")
  } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$count
`;
  const output = runPowerShell(script, { allowFailure: true }).trim();
  const cleanedCount = Number.parseInt(output, 10);
  if (Number.isFinite(cleanedCount) && cleanedCount > 0) {
    run.pass("orphaned QA Electron processes cleaned up", { count: cleanedCount });
  }
}

async function closeApp(app, run) {
  if (app === undefined) {
    return;
  }
  if (app.__deskagotchiClosed === true) {
    return;
  }
  app.__deskagotchiClosed = true;
  let pid;
  try {
    pid = app.process().pid;
  } catch {
    return;
  }
  try {
    await withTimeout(
      app.evaluate(({ app }) => {
        app.quit();
      }),
      2_000
    );
  } catch {
    // The app may already be closing.
  }
  try {
    await withTimeout(app.close(), 3_000);
  } catch {
    // Playwright may report close failure after app.quit completes.
  }
  await delay(800);
  let descendants = getDescendantProcesses(pid);
  if (descendants.length === 0) {
    run.pass("QA process tree cleaned up", { pid });
    return;
  }
  if (IS_WINDOWS) {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore"
    });
    await delay(500);
  }
  descendants = getDescendantProcesses(pid);
  if (descendants.length === 0) {
    run.pass("QA process tree cleaned up", {
      pid,
      forcedCleanup: true
    });
    return;
  }
  run.fail("QA process tree cleaned up", { pid, descendants });
}

function getDescendantProcesses(pid) {
  if (!IS_WINDOWS) {
    return [];
  }
  const script = `
$root = ${pid}
$processes = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine
$descendants = @()
$frontier = @($root)
while ($frontier.Count -gt 0) {
  $current = $frontier[0]
  if ($frontier.Count -eq 1) {
    $frontier = @()
  } else {
    $frontier = $frontier[1..($frontier.Count - 1)]
  }
  $children = @($processes | Where-Object { $_.ParentProcessId -eq $current })
  foreach ($child in $children) {
    $descendants += $child
    $frontier += $child.ProcessId
  }
}
$descendants | ConvertTo-Json -Compress
`;
  const output = runPowerShell(script, { allowFailure: true }).trim();
  if (output.length === 0) {
    return [];
  }
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function scenarioConfidenceLabel(run) {
  if (run.scenario === "drag") {
    return run.report.evidenceTier === "os-desktop"
      ? "automated-pass"
      : "automated-partial";
  }
  return "automated-pass";
}

function exactClaimFor(run, label) {
  if (label === "failed") {
    return "No fixed claim allowed.";
  }
  if (run.scenario === "drag") {
    return "passed automated drag smoke for tested Windows desktop scope; manual feel acceptance still separate";
  }
  return `passed automated ${run.scenario} QA for tested scope`;
}

function uncoveredConditionsFor(run) {
  const common = [
    "multi-monitor with negative coordinates unless captured in metadata",
    "RDP-specific behavior",
    "unusual taskbar layouts",
    "subjective desktop feel"
  ];
  if (run.scenario === "renderer") {
    return ["native desktop compositor behavior"];
  }
  return common;
}

function renderReport(report) {
  const checks = report.checks
    .map((check) => `- ${check.status === "pass" ? "PASS" : "FAIL"}: ${check.name}`)
    .join("\n");
  const artifacts = report.artifacts.map((artifact) => `- ${artifact}`).join("\n");
  const uncovered = (report.uncoveredConditions ?? [])
    .map((condition) => `- ${condition}`)
    .join("\n");
  return `# Deskagotchi QA Report

Scenario: ${report.scenario}
Run ID: ${report.runId}
Confidence: ${report.confidenceLabel}
Evidence tier: ${report.evidenceTier}
Exact claim allowed: ${report.exactClaimAllowed}

## Checks

${checks || "- No checks recorded."}

## Artifacts

${artifacts || "- No artifacts recorded."}

## Uncovered Conditions

${uncovered || "- None listed."}
`;
}

function appendLog(run, line) {
  fs.appendFileSync(path.join(run.runDir, "console.log"), `${line}\n`, "utf8");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runCommand(command, args, options = {}) {
  const commandParts = IS_WINDOWS
    ? ["cmd.exe", ["/d", "/s", "/c", command, ...args]]
    : [command, args];
  const child = spawnSync(commandParts[0], commandParts[1], {
    cwd: options.cwd ?? ROOT_DIR,
    env: process.env,
    stdio: "inherit"
  });
  if (child.status !== 0) {
    const error = child.error instanceof Error ? `: ${child.error.message}` : "";
    throw new Error(
      `${command} ${args.join(" ")} exited with ${child.status}${error}`
    );
  }
}

function runPowerShell(script, options = {}) {
  const child = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    {
      cwd: ROOT_DIR,
      encoding: "utf8"
    }
  );
  if (child.status !== 0 && !options.allowFailure) {
    throw new Error(child.stderr || `PowerShell exited with ${child.status}`);
  }
  return child.stdout;
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function withTimeout(promise, milliseconds) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timed out.")), milliseconds);
    })
  ]);
}

void main();
