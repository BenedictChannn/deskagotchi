import { spawnSync } from "node:child_process";

export function readQaSourceState(rootDir) {
  const commit = runGit(rootDir, ["rev-parse", "HEAD"]);
  const shortCommit = runGit(rootDir, ["rev-parse", "--short", "HEAD"]);
  const branch = runGit(rootDir, ["branch", "--show-current"]);
  const status = runGit(rootDir, ["status", "--porcelain=v1"]);
  const dirtyEntries = status.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return {
    commit: commit.ok ? commit.stdout : "unknown",
    shortCommit: shortCommit.ok ? shortCommit.stdout : "unknown",
    branch: branch.ok ? branch.stdout : "unknown",
    dirty: dirtyEntries.length > 0,
    dirtyEntries
  };
}

function runGit(rootDir, args) {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "pipe"
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}
