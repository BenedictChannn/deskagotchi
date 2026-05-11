# Deskagotchi V2 Manual Acceptance Runbook

This runbook is the execution guide for the remaining manual V2 gates in
`docs/qa/v2-manual-acceptance.html`.

Use it after the automated QA evidence is green. Do not check a manual gate
unless the named behavior was actually tested in the described environment. If a
gate cannot be tested for V2, use a deferral with an approver and a concrete
rationale.

## Objective

Produce one exported `v2-manual-acceptance-export.json` that resolves every
manual gate by either:

- checking the gate after real execution, or
- deferring the gate with `Accepted out of scope by` and a gate-specific
  rationale.

That JSON is required before `npm.cmd run qa:v2:closeout` can pass.

## Prep

Start from a clean branch and run the current automated evidence set:

```powershell
npm.cmd run qa
npm.cmd run qa:release
DESKAGOTCHI_IDLE_SECONDS=300 npm.cmd run qa:desktop:idle
npm.cmd run qa:v2:manual-context
```

Open:

```text
docs/qa/v2-manual-acceptance.html
```

Paste the generated
`.qa-runs/<run-id>-manual-context/manual-context.json` into the manual context
import box and click `Apply Context`. This only fills run context and note
starters; it does not check any gates.

## Gate Execution

| Gate IDs | Action | Evidence To Record |
| --- | --- | --- |
| `visual.pets`, `visual.animations`, `visual.food`, `visual.cohesion` | Review `docs/qa/v2-visual-acceptance.html`, `docs/qa/pet-animation-gallery.html`, and `docs/qa/v2-visual-review-notes.md`. Check only if the current assets are acceptable for V2. | Short note confirming the reviewed files and any caveat, especially that food icons are acceptable with compact labels rather than icon-only perfection. |
| `installer.install` | Run the installer manually from the path in the run context. Choose a temporary install directory. | Installer path, chosen install directory, and whether the installer UI was understandable and completed. |
| `installer.launch` | Launch the installed app from the installed location. Confirm it opens to the pet overlay. | Installed executable path and a note that the pet overlay appeared. |
| `installer.uninstall` | Uninstall through Windows Apps/Settings or the generated uninstaller. Confirm the installed executable is removed. | Uninstall path used and post-uninstall file/process observation. |
| `startup.enable` | In the packaged app, enable Launch on startup in Settings. | Note that this used the packaged app, not dev/QA mode. |
| `startup.login` | Sign out/in or restart Windows. Confirm Deskagotchi opens once and the pet is recoverable. | Login/restart method, timestamp, and whether any duplicate app instances appeared. |
| `startup.disable` | Disable Launch on startup after the login test. | Note that startup was disabled again after the test. |
| `monitors.right` | With a right-side monitor layout, run `npm.cmd run qa:desktop:drag`, manually drag across displays, quit, and relaunch. | Drag QA run ID, monitor arrangement, scale factors, and restore observation. |
| `monitors.stacked` | With a stacked-above or stacked-below layout, run `npm.cmd run qa:desktop:drag`, manually drag across displays, quit, and relaunch. | Drag QA run ID, monitor arrangement, scale factors, and restore observation. |
| `monitors.dpi` | With mixed-DPI displays, drag the pet across displays and relaunch. | Scale factors and whether drag delta or restore felt wrong. |
| `sleep.visible` | Launch the packaged or dev app, put the machine to sleep for at least five minutes, wake/unlock, and confirm the pet is visible or tray-recoverable. | Sleep duration and visibility/recovery result. |
| `sleep.state` | After wake, open health/status and confirm stats refresh instead of remaining stale. | Before/after observation if available. |
| `sleep.process` | After wake, check that no duplicate or stuck Deskagotchi processes remain. | Output or summary from the process check command below. |
| `environment.rdp` | Test over RDP if available. | RDP host/client setup and whether the pet remains visible/recoverable. |
| `environment.taskbar` | Test with unusual taskbar placement or auto-hide if available. | Taskbar setup and any window-boundary issue. |
| `environment.smartscreen` | Run or inspect the installer behavior for Windows SmartScreen/signing reputation. | Whether SmartScreen appeared and what user-facing caveat is needed for unsigned builds. |

Useful process check:

```powershell
Get-Process | Where-Object { $_.ProcessName -match 'Deskagotchi|electron' } |
  Select-Object Id,ProcessName,MainWindowTitle
```

If the command prints nothing after quit/uninstall, record that no matching
processes were found.

## Deferrals

Use deferrals only when a gate is genuinely unavailable in the V2 test
environment, for example no stacked-monitor hardware, no RDP environment, or no
practical way to trigger SmartScreen on an already trusted local build.

Deferral requirements:

- Fill `Accepted out of scope by`.
- Check the deferral checkbox for the exact gate.
- Add a rationale that says why the gate could not be executed and what the
  remaining risk is.
- Do not also check the gate unless it was actually tested and passed.

Example rationale:

```text
No stacked monitor layout is available on the V2 test machine. Bounds logic has
unit coverage and the current two-monitor left-side layout passed automated
drag QA, but physical stacked layout remains untested for this release.
```

## Export And Closeout

After resolving every manual gate, choose one evidence flow.

### Option A: Commit The Manual Evidence

1. Click `Export Report` or `Download JSON`.
2. Save the export as `docs/qa/v2-manual-acceptance-export.json`.
3. Refresh the closeout report:

```powershell
npm.cmd run qa:v2:audit -- --manual docs\qa\v2-manual-acceptance-export.json
```

4. Commit the manual evidence and refreshed report:

```powershell
git add docs\qa\v2-manual-acceptance-export.json docs\qa\v2-closeout-report.md
git commit -m "docs(qa): add v2 manual acceptance evidence"
```

5. Run the final clean-worktree gate:

```powershell
npm.cmd run qa:v2:closeout
```

This is the normal release-branch path because `qa:v2:closeout` intentionally
requires a clean Git worktree.

### Option B: Keep The Manual Evidence External

If the export lives outside the repository, pass its absolute path to the
strict audit command:

```powershell
npm.cmd run qa:v2:audit -- --manual C:\path\to\v2-manual-acceptance-export.json --strict --check-only
```

Use the external path only when the manual JSON is stored in another release
evidence system. The tracked `npm.cmd run qa:v2:closeout` script only reads the
default in-repo manual export paths.

The strict gate should not pass until the manual JSON is complete and the Git
worktree is clean.
