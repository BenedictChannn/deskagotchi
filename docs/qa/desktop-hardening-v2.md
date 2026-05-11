# Deskagotchi V2 Desktop Hardening Plan

Desktop behavior is a V2 release gate. These checks should happen after the
main user-facing care, pet, food, and play improvements are in place, because
hardening before the interaction surface settles creates churn.

The goal is not only "the app launches." The goal is that Deskagotchi behaves
like a reliable desktop companion across normal Windows usage: closing,
sleeping, waking, monitor changes, DPI scaling, always-on-top settings, tray
recovery, and stuck-window cleanup.

## Scope

This plan covers native desktop behavior:

- Frozen or orphaned window cleanup.
- Tray recovery and explicit quit.
- Always-on-top behavior.
- Dragging and bounds clamping.
- Multi-monitor movement and recovery.
- High-DPI and mixed-DPI behavior.
- Sleep, wake, resume, and unlock handling.
- Startup restore.
- Click-through and transparent-window hit testing.
- Play-mode full-monitor overlay restore.
- Save/profile safety during QA.

## Risk Classification

All desktop hardening work is P0 in the QA contract. Do not close it with a
renderer-only check.

Minimum evidence:

- Relevant `npm.cmd run qa:desktop:*` command.
- `.qa-runs/<run-id>/report.md`.
- Bounds or lifecycle artifacts where applicable.
- Manual acceptance note for subjective desktop feel.
- Exact scoped claim, not broad "fixed" language.

## Hardening Matrix

| Area | Failure mode | Required checks |
| --- | --- | --- |
| Frozen windows | Window remains visible after quit or cannot be closed. | Launch, close, tray quit, process check, no orphaned Electron windows. |
| Recovery | Pet is offscreen, hidden, or impossible to reach. | Tray show, reset position, startup clamping, saved bounds recovery. |
| Drag | Drag opens menu, moves wrong amount, or loses pet offscreen. | Pointer drag, click suppression, edge clamp, persisted bounds. |
| Multi-monitor | Pet cannot move to another display or restores to wrong display. | Right, left/negative-coordinate, stacked, and primary-only display layouts. |
| Always-on-top | Setting ignored or persists incorrectly. | Toggle setting, relaunch, verify overlay z-order behavior manually. |
| Sleep/wake | Pet state stale or window broken after machine resume. | Resume/unlock tick, renderer refresh, no duplicate windows. |
| DPI scaling | Drag delta or bounds wrong on scaled display. | 100 percent, 125 percent, and mixed-DPI manual/automated evidence where available. |
| Play mode | Full-monitor overlay gets stuck or restores wrong bounds. | Enter play, drag ball, exit via X/Escape, verify compact overlay bounds restored. |
| Click-through | Pet becomes unclickable or blocks desktop when it should not. | Toggle states, hover/click care menu, desktop pass-through where supported. |
| Lifecycle | Second launch, close, hide/show, quit, and relaunch misbehave. | Single-instance lock, tray menu, process cleanup, state persistence. |
| Startup on boot | Dev or QA accidentally mutates real Windows startup entries, or packaged startup does not apply. | QA verifies persistence and skipped native mutation; packaged OS startup still needs manual installer-machine acceptance. |

## Targeted QA Commands

Use these while iterating:

```powershell
npm.cmd run qa:desktop:launch
npm.cmd run qa:desktop:drag
npm.cmd run qa:desktop:overlay
npm.cmd run qa:desktop:play
npm.cmd run qa:desktop:lifecycle
npm.cmd run qa:desktop:idle
```

`qa:desktop:drag` records `display-topology.json` and exercises a real
negative-coordinate monitor drag when the current Windows layout has an
eligible left-side display. Right-side and stacked monitor layouts still need
their own physical setup or manual acceptance note.

`qa:desktop:idle` records `idle-cpu.json`. Use `DESKAGOTCHI_IDLE_SECONDS=300`
for the V2 five-minute idle observation; shorter runs are useful while
iterating but should not be used as final idle evidence.

`qa:desktop:lifecycle` verifies that `launchOnStartup` persists while QA skips
the native login-item mutation. This protects the developer machine during
automated runs. A real packaged startup-on-boot check still requires a manual
Windows login/restart pass.

Run the full gate before making a broad readiness claim:

```powershell
npm.cmd run qa
```

Run release smoke before installer readiness claims:

```powershell
npm.cmd run qa:release
```

That command rebuilds the installer, checks packaged resources, launches the
unpacked packaged executable, silently installs into `.qa-runs/`, launches the
installed executable, and runs the generated uninstaller. It does not replace a
human pass through the interactive installer UI or SmartScreen behavior.

## Manual Acceptance Form

Use `docs/qa/v2-manual-acceptance.html` for the full V2 manual pass. The
minimal text form below is kept for quick notes during desktop-only checks:

```text
automation_run_id:
windows_version:
monitor_setup:
scale_factors:
sleep_wake_tested: yes/no
always_on_top_tested: yes/no
manual_pass: yes/no
failed_step:
notes:
blocks_v2_release: yes/no
```

## Release Gate

V2 desktop hardening passes only when:

- The pet can always be recovered from tray or reset position.
- Closing the window never leaves an unclosable visible pet.
- Quitting removes the overlay and exits all normal app processes.
- Dragging works without opening the care menu.
- Saved bounds restore visibly on the correct monitor.
- Play mode restores the pre-play compact overlay.
- Resume/unlock progresses simulation and refreshes the renderer.
- Always-on-top obeys settings across relaunch.
- QA artifacts support the exact claim being made.
