# Deskagotchi V2 Manual Acceptance Checklist

Use this checklist with `.qa-runs/latest-v2-manual-acceptance.html`.

This file is a short execution aid. It does not replace
`docs/qa/v2-manual-acceptance-runbook.md`, and it does not mark any gate as
passed. Check a gate only after you actually tested the behavior. Defer a gate
only when the environment is unavailable, with an approver and a concrete risk
note.

## Current Context

- Acceptance page: `.qa-runs/latest-v2-manual-acceptance.html`
- Current release candidate: `release\Deskagotchi Setup 0.1.0.exe`
- Latest generated build context: `0.1.0 / dc45531`
- Required export path: `docs\qa\v2-manual-acceptance-export.json`
- Final gate after export: `npm.cmd run qa:v2:closeout`

Keep the generated build and installer fields unchanged. If a newer app,
package, source, or asset change is made, regenerate manual context before
testing.

## Batch 1: Visual Acceptance

Open:

- `docs/qa/v2-visual-acceptance.html`
- `docs/qa/pet-animation-gallery.html`
- `docs/qa/v2-visual-review-notes.md`

Check these gates only if true:

- `visual.pets`: Bao, Miso, Mochi, Peanut, and Puddles read as the intended
  animals at desktop size.
- `visual.animations`: Animation rows have visible but not distracting movement.
- `visual.food`: Food icons are roughly identifiable with compact labels.
- `visual.cohesion`: Pets and foods share a coherent monochrome LCD style.

Suggested evidence note:

```text
Reviewed v2-visual-acceptance.html, pet-animation-gallery.html, and
v2-visual-review-notes.md. The five built-in pets are recognizable at overlay
size, animation rows show acceptable small movement, food icons are identifiable
enough with compact labels, and the monochrome LCD style is coherent for V2.
```

## Batch 2: Interactive Installer

Run `release\Deskagotchi Setup 0.1.0.exe`.

Check these gates only if true:

- `installer.install`: Interactive installer completes without broken or
  confusing UI.
- `installer.launch`: Installed app launches to the pet overlay.
- `installer.uninstall`: Interactive uninstall removes the installed executable.

Suggested evidence note:

```text
Installer path: release\Deskagotchi Setup 0.1.0.exe. Installed to <path>.
Install UI completed successfully. Installed app launched to the transparent pet
overlay. Uninstalled via <path or Windows Apps>. After uninstall, the installed
Deskagotchi executable was removed and no Deskagotchi process remained.
```

Process check:

```powershell
Get-Process | Where-Object { $_.ProcessName -match 'Deskagotchi|electron' } |
  Select-Object Id,ProcessName,MainWindowTitle
```

## Batch 3: Startup On Login

Use the packaged app, not dev mode.

Check these gates only if true:

- `startup.enable`: Launch on startup is enabled from packaged Settings.
- `startup.login`: After restart or sign out/in, exactly one Deskagotchi opens.
- `startup.disable`: Launch on startup is disabled again after the test.

Suggested evidence note:

```text
Used packaged app Settings to enable Launch on startup. Restart/sign-in method:
<restart or sign out/in>. Timestamp: <time>. Deskagotchi opened once to the pet
overlay with no duplicate app instances. Disabled Launch on startup again after
the test.
```

## Batch 4: Sleep And Recovery

Launch Deskagotchi and sleep the machine for at least five minutes.

Check these gates only if true:

- `sleep.visible`: After wake/unlock, the pet is visible or tray-recoverable.
- `sleep.state`: Health/status refreshes instead of staying stale.
- `sleep.process`: No duplicate or stuck Deskagotchi processes remain.

Suggested evidence note:

```text
Sleep duration: <minutes>. After wake/unlock, the pet was <visible or recovered
from tray>. Health/status panel refreshed after wake. Process check showed
<no duplicate/stuck Deskagotchi processes or exact process summary>.
```

## Batch 5: Physical Monitor Layouts

Use real Windows display arrangement where available.

Check these gates only if true:

- `monitors.right`: Right-side monitor drag and relaunch restore work.
- `monitors.stacked`: Stacked-above or stacked-below layout works.
- `monitors.dpi`: Mixed-DPI drag and restore behavior is acceptable.

Suggested evidence note:

```text
Monitor setup: <arrangement and scale factors>. Dragged the pet across displays,
quit, and relaunched. Restore behavior was acceptable: <observation>. Related
automated drag evidence: 2026-05-11T14-33-54Z-drag.
```

Suggested deferral note for unavailable layouts:

```text
<Layout> is unavailable on the V2 test machine. Current bounds logic has unit
coverage and the available physical layout passed automated drag QA, but this
specific physical layout remains untested for V2. Accepted risk: <risk>.
```

## Batch 6: Environment Caveats

Run only if the environment is available. Otherwise defer the exact gate.

Check these gates only if true:

- `environment.rdp`: RDP behavior is acceptable.
- `environment.taskbar`: Unusual taskbar layout or auto-hide is acceptable.
- `environment.smartscreen`: SmartScreen/signing caveat is documented for this
  unsigned build.

Suggested evidence note:

```text
RDP: <tested result or deferred reason>. Taskbar: <tested layout and result or
deferred reason>. SmartScreen/signing: <observed prompt or caveat for unsigned
local build>. Remaining release risk: <risk>.
```

## Export And Closeout

After all 19 gates are checked or deferred:

1. Click `Export Report` or `Download JSON`.
2. Save as `docs\qa\v2-manual-acceptance-export.json`.
3. Run:

```powershell
npm.cmd run qa:v2:audit -- --manual docs\qa\v2-manual-acceptance-export.json
git add docs\qa\v2-manual-acceptance-export.json docs\qa\v2-closeout-report.md
git commit -m "docs(qa): add v2 manual acceptance evidence"
npm.cmd run qa:v2:closeout
```

The goal is complete only when `npm.cmd run qa:v2:closeout` passes from a clean
worktree.
