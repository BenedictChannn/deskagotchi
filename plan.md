# Deskagotchi QA System Plan

## Main Goal

Build a closed-loop QA system for Deskagotchi so new features can be implemented, exercised, and verified by Codex without relying only on code inspection or user reports.

The QA system must make desktop behavior testable enough that a feature is not called fixed until the app has been launched, interacted with, and checked through repeatable evidence.

## Non-Negotiable Standard

For Deskagotchi, "fixed" means evidence-backed, not assumed.

Any feature or bug fix that touches native desktop behavior must satisfy all applicable criteria:

- A written pass/fail spec exists before or alongside the implementation.
- A local command can run the relevant check.
- The check uses an isolated profile and does not touch the user's real save data.
- The check exercises the same production code path unless explicitly labeled as instrumented-only.
- The run captures decisive evidence: bounds, logs, screenshots or recording, and a concise report.
- Remaining manual validation is explicitly listed and scoped.
- The final implementation report includes commands run, pass/fail status, artifact path, tested scope, uncovered conditions, and the exact claim allowed.

## Claim Policy

Do not use unqualified "fixed" language for desktop-native behavior.

Allowed claim patterns:

- `passed automated drag smoke on Windows single-monitor 100 percent`
- `mechanically passing for tested scope`
- `fixed for tested scope, pending user feel acceptance`
- `not yet user-validated`

Disallowed claim patterns:

- `dragging is fixed`
- `desktop behavior is fixed`
- `works now`

For native desktop behavior, a final implementation response must state:

- tested scope
- environment
- confidence label
- artifact path
- uncovered conditions
- manual acceptance status
- exact claim allowed

Manual acceptance remains separate from automated proof. A failed manual acceptance blocks any broader fixed claim even when automation passes.

## Confidence Labels

Every QA report should produce one of these labels:

- `automated-pass`: automated checks fully passed for the stated scope.
- `automated-partial`: automation passed some mechanical checks, but important coverage is missing.
- `manual-required`: automation cannot judge the user-facing behavior or environment-specific feel.
- `failed`: one or more required checks failed.

No desktop-native feature should be described as fixed with only `automated-partial` or `manual-required`.

## Architecture Principles

### Test the Real App Path

QA hooks are allowed only when they observe, reset state, or collect evidence. They must not bypass the production event path being tested.

For example, the drag test may read native bounds through a QA helper, but the drag itself must go through the visible pet sprite, renderer pointer handling, preload IPC, main-process validation, and `BrowserWindow` movement.

### Separate Instrumented and Production-Like Modes

The QA system should support two modes:

- Instrumented QA mode: deterministic profile, telemetry, reset helpers, stable seed state, and structured logs.
- Production-like smoke mode: normal window flags, CSS, preload bridge, IPC, transparency, and event handling.

A "fixed for tested scope" claim for native desktop behavior requires production-like smoke evidence. Instrumented mode can explain failures, but cannot be the only proof.

### Production-Like Difference Budget

Allowed differences in production-like QA mode:

- temporary `userData` profile
- deterministic initial save data
- telemetry observation
- report/artifact capture
- test-only read helpers
- test-only quit helper

Forbidden differences in production-like QA mode:

- changed window flags relevant to behavior under test
- changed `transparent`, `frame`, `resizable`, or always-on-top behavior
- changed CSS hit regions or `app-region`
- changed pointer-capture behavior
- changed preload IPC path
- changed main-process movement logic
- changed route for the tested surface
- changed save/persistence implementation
- direct window movement from the test helper for a drag assertion

Production-like QA must assert and record the relevant startup invariants before running the interaction.

### Keep Evidence Decisive

Generated artifacts should live in an ignored folder such as `.qa-runs/<timestamp>/`.

Committed docs should describe specs and checklists. Routine run outputs should not be committed unless a curated artifact is useful for a PR or decision record.

Each run should also update a stable pointer such as `.qa-runs/latest/` or write the latest run path to a small ignored file so the user can inspect evidence without hunting through timestamps.

### Calibrate By Risk

Native desktop/window behavior needs strict proof. Ordinary React panel work can use lighter renderer checks.

Risk levels:

- P0 native behavior: drag, click-through, window bounds, tray lifecycle, always-on-top, monitor changes, persistence, startup.
- P1 interaction behavior: overlay care flows, Ball play, import/export dialogs, Hatch flow.
- P2 renderer behavior: panel layout, route rendering, forms, visual regressions.
- P3 pure domain logic: simulation, validation, package parsing, storage schema.

## Telemetry Schema

Telemetry must be useful for comparing runs, not decorative.

Every event in `events.jsonl` should include:

- `runId`
- `timestamp`
- `event`
- `source`
- `windowRole`, when applicable
- `displayId`, when applicable
- `scaleFactor`, when applicable
- `error`, when applicable

Drag-specific payloads:

- `drag:start`: `{ pointer: { x, y }, windowBounds }`
- `drag:move`: `{ delta: { x, y }, pointer: { x, y }, windowBounds }`
- `drag:end`: `{ totalDelta: { x, y }, windowBounds, menuOpen }`
- `window:setBounds`: `{ from, to, reason }`
- `window:persistBounds`: `{ bounds, profilePath, savePath }`
- `menu:open`: `{ reason, duringDrag }`
- `app:quitForTest`: `{ pid, descendants }`

## Sub-Goal 0: QA Harness Skeleton

This goal creates only the minimum scaffolding needed to make the first drag loop safe and reviewable. It should not grow into a broad framework before drag is proven.

### Planned Command

`pnpm run qa:desktop:launch`

### Scope

Launch Deskagotchi in a clean QA run, collect startup evidence, and quit cleanly without running feature-specific interactions.

### Required Capabilities

- Add `.qa-runs/` to `.gitignore`.
- Create a stable `runId`.
- Create `.qa-runs/<timestamp-or-runId>/`.
- Create or update a local latest-run pointer.
- Create an isolated temp profile path.
- Set Electron `userData` to that profile before runtime or storage initialization.
- Record the resolved `userData` path and save path.
- Track only the process tree launched by this QA run.
- Refuse to run if a non-QA Deskagotchi instance is already active.
- Write `metadata.json`, `events.jsonl`, `console.log`, and `report.md`.
- Quit cleanly through a test-only helper or normal app quit.
- Verify no descendant process from this QA run remains.

### Startup Invariants To Record

- app version
- run mode
- PID tree
- temp profile path
- resolved `userData` path
- resolved save path
- renderer route
- preload path
- display ID, work area, bounds, and scale factor
- overlay window role
- relevant window flags: `frame`, `transparent`, `resizable`, `alwaysOnTop`, `skipTaskbar`
- platform and Windows session details available to the app

### Verifiable Success Criteria

- `pnpm run qa:desktop:launch` launches and quits without manual action.
- No real user data path appears in `metadata.json`.
- The report states `automated-pass` for launch/quit only.
- The cleanup check targets only descendants of the QA run.
- A failed launch still writes a readable report.

## Sub-Goal 1: Drag Trust Loop

This is the first interaction goal. It directly addresses the current trust gap where dragging was previously described as fixed without enough evidence.

### Planned Commands

- `pnpm run qa:desktop:drag`
- Future fallback or extension: `pnpm run qa:desktop:drag:os`

### Scope

Verify that user-like drag input on the visible pet sprite moves the native transparent overlay window, does not open the care menu, clamps at the work-area edge, and persists after restart.

### Red Baseline Requirement

Before fixing drag code, the harness must prove it can detect a failure:

- Run the drag test against the current behavior or a known broken variant.
- Record whether the run fails.
- If the test passes unexpectedly, inspect whether the test is too weak before touching drag implementation.
- Do not use a drag test as proof until it has produced one meaningful failing run or has been validated against an intentional broken-path check.

### Evidence Tiers

The drag loop has two evidence tiers:

- `electron-internal`: Electron/Playwright window and page evidence, native bounds, telemetry, and renderer screenshots.
- `os-desktop`: native OS input plus a desktop-composited screenshot or recording showing the pet over a known background or window.

Only `os-desktop` evidence can produce `automated-pass` for the full drag claim. `electron-internal` evidence can produce only `automated-partial` for drag until OS-level evidence exists.

### Input Strategy

Version 1 may start with Electron/Playwright pointer input if it travels through the visible pet sprite path and records telemetry plus native bounds.

If Playwright input cannot prove the failure class, the plan must add `qa:desktop:drag:os` using OS-level mouse input and desktop-composited evidence before any full drag claim is allowed.

### Required Capabilities

- Reuse Sub-Goal 0 launch, profile, process, and report behavior.
- Use deterministic initial pet state and initial overlay bounds.
- Identify the overlay window by role, not by raw window count.
- Assert production-like startup invariants relevant to drag.
- Read native overlay bounds before and after actions.
- Capture before and after screenshots.
- Capture at least one OS-level desktop screenshot or recording before full `automated-pass`.
- Collect renderer console errors and main-process errors.
- Verify scale factor and coordinate unit conversion for pointer deltas and Electron bounds.
- Wait for confirmed persisted save data before quit/relaunch.
- Quit the app cleanly after the run.
- Verify no descendant process from this QA run remains.

### Required Telemetry

- `drag:start`
- `drag:move`
- `drag:end`
- `window:setBounds`
- `menu:open`
- `window:persistBounds`
- `app:quitForTest`

Telemetry payloads must follow the schema in `Telemetry Schema`.

### Verifiable Success Criteria

- The overlay window appears in production-like mode.
- The test records startup invariants and verifies no forbidden production-like differences.
- The test locates the visible pet sprite.
- A click without movement opens the care menu.
- A drag of at least `40px` equivalent, after scale-factor conversion, changes native window bounds.
- Final bounds are within a defined tolerance, initially `+/-12` device-independent pixels, of the expected drag delta.
- `menu:open` does not occur between `drag:start` and a short post-drag settle window.
- Dragging toward the work-area edge leaves the overlay visible and clamped.
- The final valid position is persisted to the QA profile save file.
- The test waits for confirmed persisted bounds before quitting.
- Relaunching with the same QA profile restores the persisted valid position.
- The report stamps exact environment and explicitly lists uncovered conditions such as multi-monitor, RDP, and unusual taskbar layouts when not tested.
- The run writes:
  - `report.md`
  - `metadata.json`
  - `bounds.json`
  - `events.jsonl`
  - `console.log`
  - `before.png`
  - `after.png`
  - optional `drag-evidence.webm` or `drag-evidence.gif`

### Manual Acceptance Form

This acceptance should be recorded only after automation passes.

Fields:

- `automation_run_id`
- `manual_pass: yes/no`
- `failed_step`
- `notes`
- `blocks_fixed_claim: yes/no`

Checklist:

1. Launch Deskagotchi.
2. Drag the pet three times in normal desktop use.
3. Click the pet and confirm the care menu opens.
4. Drag near a screen edge and confirm the pet remains recoverable.
5. Restart the app.
6. Confirm the pet returns to the last valid visible position.

### Done Criteria

Sub-Goal 1 is complete only when:

- `pnpm run qa:desktop:drag` exists and runs locally.
- The test has produced a meaningful red baseline or intentional broken-path failure.
- The generated report clearly states the evidence tier.
- Full drag `automated-pass` is withheld until OS-level evidence exists.
- The report includes the exact artifact path and exact claim allowed.
- The manual acceptance form is documented as the remaining feel check.

## Sub-Goal 2: Feature QA Contract and Reporting Discipline

This goal moves reporting discipline earlier so future features cannot bypass the QA system while broader automation is still immature.

### Scope

Define how every future feature chooses the right QA depth and how Codex reports validation.

### Required Feature Template

Every future Deskagotchi feature plan should include:

- feature name
- risk level: P0, P1, P2, or P3
- user-facing behavior
- production-like invariants that must not change
- automation command required
- evidence tier required
- manual acceptance form, if any
- artifact expectations
- definition of done
- exact claim allowed when checks pass

### Verifiable Success Criteria

- Native desktop features list at least one desktop QA command.
- Renderer-only features list at least one renderer QA command.
- Domain-only features list unit tests or focused integration tests.
- Every report includes tested scope, environment, uncovered conditions, confidence label, artifact path, and exact claim allowed.
- The final implementation response cannot omit validation status.

## Sub-Goal 3: Desktop QA Harness Foundation

After drag is proven, generalize only the harness pieces that were useful in Sub-Goals 0 and 1.

### Scope

Create reusable QA infrastructure for launching, inspecting, interacting with, and cleaning up Deskagotchi desktop runs.

### Required Capabilities

- Isolated profile creation.
- Stable QA run ID.
- Stable artifact directory.
- Latest-run pointer.
- Window role detection:
  - `overlay`
  - `panel`
  - `play-overlay`
  - `hidden-background`, if needed
- Native bounds inspection.
- Display/work-area inspection.
- Renderer screenshot capture.
- OS-level desktop screenshot or recording when native compositor behavior is part of the claim.
- Main-process and renderer console capture.
- Clean app shutdown.
- Descendant-process cleanup verification.

### Verifiable Success Criteria

- A smoke test can launch and quit the app without user interaction.
- The harness can identify overlay and panel windows by role.
- A failed run still writes a report.
- The report includes app version, run mode, display info, profile path, and artifact path.
- The harness can run repeatedly without touching real user data.
- The harness can fail fast when an existing non-QA Deskagotchi instance would interfere.

## Sub-Goal 4: Overlay Care Interaction Loop

### Planned Command

`pnpm run qa:desktop:overlay`

### Scope

Automate the compact overlay interactions currently covered by manual smoke docs.

### Verifiable Success Criteria

- Click pet opens the compact care menu.
- Menu contains the expected actions: Feed, Play, Clean, Sleep, Med, Health.
- Health opens compact overlay status, not the full panel.
- Escape closes transient overlay UI.
- Feed opens the feed picker.
- Meal and Snack tabs can be selected.
- Selecting a food updates the active snapshot.
- Clean, Sleep, and Med flows open in-place and dismiss predictably.
- No full panel window opens from normal overlay care actions.
- Screenshots are captured for menu, health, feed picker, and closed state.

### Done Criteria

- Existing checklist docs are updated to point at the automated command.
- Manual checks are reduced to subjective feel and visual polish.

## Sub-Goal 5: Ball Play Desktop Loop

### Planned Command

`pnpm run qa:desktop:play`

### Scope

Verify the Ball play mode that expands the transparent overlay to the current monitor and then restores normal pet bounds.

### Verifiable Success Criteria

- Play picker opens from the overlay.
- Selecting Ball enters play mode.
- Native overlay bounds expand to the current display work area.
- Expanded play bounds are not persisted as normal pet bounds.
- Ball can be pointer-dragged and released.
- Ball remains inside stage bounds after release.
- Pet position changes toward the ball according to telemetry or DOM state.
- Catch count increments or reward action is observed.
- X exits play mode.
- Escape exits play mode.
- Normal small overlay bounds are restored after exit.
- Restart does not restore the full-monitor play bounds.

### Done Criteria

- A report can show normal bounds, play bounds, restored bounds, and persisted bounds.
- The old Ball manual smoke checklist becomes a short subjective validation checklist.

## Sub-Goal 6: Panel and Renderer QA Loop

### Planned Command

`pnpm run qa:renderer`

### Scope

Use the existing browser development bridge to test fast renderer surfaces without launching the full desktop runtime for every UI change.

### Routes

- `#/panel/status`
- `#/panel/pet-selector`
- `#/panel/hatch`
- `#/panel/settings`
- `#/overlay`

### Verifiable Success Criteria

- Vite starts on the known renderer port.
- Each route renders without fatal state.
- Console errors fail the run.
- Core controls are visible and clickable.
- Screenshots are captured for each route.
- Hatch form can validate basic input.
- Settings controls can toggle in the browser dev bridge.
- Pet selector can switch pets in the browser dev bridge.

### Done Criteria

- Renderer-only UI work can be validated quickly without launching Electron.
- Desktop-native claims still require the desktop QA commands.

## Sub-Goal 7: Tray and Lifecycle Loop

### Planned Command

`pnpm run qa:desktop:lifecycle`

### Scope

Verify app lifecycle behavior that is hard to test in a browser: tray actions, hide/show, panel close behavior, startup recovery, and clean quit.

### Verifiable Success Criteria

- App enforces single-instance behavior.
- Overlay opens by default.
- Panel can be opened to each supported view.
- Closing the panel in development exits the app when expected.
- Packaged-style behavior can be smoke-tested separately when available.
- Hide and show restore the overlay.
- Reset position moves the overlay to default visible bounds.
- Quit exits cleanly.
- No descendant process from this QA run remains.

### Notes

Tray menu automation may require a separate OS-level automation path. If the tray cannot be automated reliably, the harness should expose production-equivalent commands through test-only launch arguments while preserving a small manual tray checklist.

## Sub-Goal 8: Asset and Visual QA Loop

### Planned Commands

- `pnpm run qa:assets:pets`
- `pnpm run qa:assets:items`

### Scope

Make pet and item asset validation repeatable and connected to visual evidence.

### Verifiable Success Criteria

- Pet package validation passes.
- Required animation rows exist.
- Asset dimensions match manifest expectations.
- Contact sheets are generated for pet sprites and item icons.
- Small-size readability checks are documented.
- The report links to generated contact sheets.
- Asset hash/version changes when production assets change.

### Done Criteria

- New built-in pets and item icons cannot be accepted without package validation plus visual QA artifacts.

## Sub-Goal 9: Local Validation Gate

### Planned Command

`pnpm run qa`

### Scope

Create a local QA entrypoint that runs the right checks for release-like confidence.

### Proposed Stages

1. `pnpm run check`
2. `pnpm run qa:desktop:launch`
3. `pnpm run qa:desktop:drag`
4. `pnpm run qa:desktop:overlay`
5. `pnpm run qa:desktop:play`
6. `pnpm run qa:renderer`

### Verifiable Success Criteria

- The command stops on first failure by default.
- A full report is written even when one stage fails.
- The summary shows each stage as pass, fail, skipped, or manual-required.
- Long-running stages print progress before heavy startup work.
- Desktop stages can be run individually during development.

## Sub-Goal 10: Optional CI Strategy

### Scope

Decide which parts of the QA system can run in CI and which must remain local Windows desktop checks.

### Likely CI Coverage

- TypeScript.
- ESLint.
- Vitest.
- Package validation.
- Renderer tests where browser automation is stable.

### Likely Local-Only Coverage

- Transparent overlay behavior.
- Native drag.
- Tray interaction.
- Always-on-top and click-through behavior.
- Multi-monitor and DPI matrix.

### Verifiable Success Criteria

- CI does not pretend to validate local-only desktop behavior.
- Local desktop QA remains the source of truth for native window claims.
- The README or QA docs clearly state what CI covers and does not cover.

## Environment Matrix

The initial automated matrix should be narrow and reliable:

- Windows, single monitor, 100 percent scaling.
- Windows, single monitor, non-100 percent scaling if available.

Manual or later automated matrix:

- Multi-monitor with negative X coordinates.
- Multi-monitor with different DPI per monitor.
- Taskbar on non-default edge.
- RDP or remote desktop session.
- Display sleep/wake and unlock.

Every report must stamp the exact environment tested and explicitly list untested environment conditions.

## Artifact Policy

Generated QA artifacts should go to:

`.qa-runs/<timestamp-or-runId>/`

Each run should include:

- `report.md`
- `events.jsonl`
- `console.log`
- `metadata.json`
- scenario-specific evidence such as `bounds.json`, screenshots, or recordings

Committed docs should live under:

- `docs/qa/`
- `plan.md`

The ignored run folder should be used for routine iteration. Only curated evidence should be copied into committed docs.

## Implementation Order

1. Update QA policy/spec docs and ignore generated run artifacts.
2. Implement Sub-Goal 0: QA Harness Skeleton.
3. Implement Sub-Goal 1: Drag Trust Loop.
4. Run and record the drag red baseline before changing drag behavior.
5. Fix drag only after the drag loop can fail meaningfully.
6. Record passing drag evidence and exact claim allowed.
7. Implement Sub-Goal 2: Feature QA Contract and Reporting Discipline.
8. Extract reusable desktop harness helpers only from proven drag needs.
9. Implement overlay care QA.
10. Implement Ball play QA.
11. Implement renderer QA.
12. Implement lifecycle/tray QA where feasible.
13. Add aggregate `pnpm run qa`.

## Current Next Step

Use the QA system as the validation gate for future Deskagotchi work:

- `pnpm run qa`

For native desktop changes, report the exact claim allowed by the relevant `.qa-runs/<runId>/report.md` artifact instead of using unqualified fixed language.
