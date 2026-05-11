# Using the Deskagotchi QA System

This guide explains how to use the local QA loop when implementing, reviewing, or validating Deskagotchi changes.

## Quick Start

Run the full local QA gate:

```powershell
npm.cmd run qa
```

This runs:

1. `npm.cmd run check`
2. `npm.cmd run qa:desktop:launch`
3. `npm.cmd run qa:desktop:drag`
4. `npm.cmd run qa:desktop:overlay`
5. `npm.cmd run qa:desktop:play`
6. `npm.cmd run qa:desktop:lifecycle`
7. `npm.cmd run qa:renderer`
8. `npm.cmd run qa:assets:pets`
9. `npm.cmd run qa:assets:items`
10. `npm.cmd run qa:v2:scope`
11. `npm.cmd run qa:v2:visual-page`
12. `npm.cmd run qa:v2:manual-page`

Use this before claiming a feature is ready when the change affects multiple surfaces.

## Targeted Commands

Use targeted commands while iterating:

| Command | Use When |
| --- | --- |
| `npm.cmd run qa:desktop:launch` | Checking the QA harness, isolated profile, startup metadata, preload bridge, and clean shutdown. |
| `npm.cmd run qa:desktop:drag` | Changing drag, overlay bounds, pointer handling, DPI behavior, persistence, or window movement. |
| `npm.cmd run qa:desktop:overlay` | Changing compact overlay menus, feed, health, care flows, or in-place overlay UI. |
| `npm.cmd run qa:desktop:play` | Changing Ball play, full-monitor overlay behavior, transient play bounds, or play exit restore. |
| `npm.cmd run qa:desktop:lifecycle` | Changing panel launch, reset position, hide/show, quit, or app lifecycle behavior. |
| `npm.cmd run qa:renderer` | Changing panel routes, renderer-only UI, settings, or pet selector UI. |
| `npm.cmd run qa:assets:pets` | Changing pet packages, pet manifests, or built-in pet assets. |
| `npm.cmd run qa:assets:items` | Changing item manifests, item icons, or item QA contact sheets. |
| `npm.cmd run qa:release` | Rebuilding the Windows package, checking packaged resources, running packaged launch and lifecycle recovery smoke, then testing silent install, installed launch, and uninstall. |
| `npm.cmd run qa:v2:audit` | Creating the V2 closeout report from the latest QA evidence and manual acceptance export. |
| `npm.cmd run qa:v2:audit:smoke` | Verifying the V2 audit rejects incomplete manual evidence and accepts complete fixture evidence. |
| `npm.cmd run qa:v2:closeout` | Running the strict V2 release gate without rewriting the tracked closeout report. |
| `npm.cmd run qa:v2:manual-context` | Collecting the current build, installer candidate, monitor topology, latest QA run IDs, and starter evidence notes before filling the manual checklist. |
| `npm.cmd run qa:v2:manual-page` | Verifying the manual acceptance page blocks export pass status until gates and required run context fields are complete; writes `.qa-runs/<run-id>-manual-page/`. |
| `npm.cmd run qa:v2:manual-page:update` | Refreshing the tracked manual acceptance page screenshot after intentional page changes. |
| `npm.cmd run qa:v2:scope` | Verifying Hatch/custom generation remains outside the V2 user-facing UI, route, preload, and IPC surfaces. |
| `npm.cmd run qa:v2:visual-page` | Verifying the visual acceptance and pet animation gallery pages contain the current pets, images, animation cells, and controls. |
| `npm.cmd run qa:v2:visual-page:update` | Refreshing the tracked visual acceptance screenshot after intentional page changes. |

The current visual review notes live in
`docs/qa/v2-visual-review-notes.md`. Update that file whenever pet or food
assets materially change.

When the manual V2 checklist JSON is downloaded outside the repo, pass it
directly:

```powershell
npm.cmd run qa:v2:audit -- --manual C:\path\to\v2-manual-acceptance-export.json
```

For final release validation, use strict check-only mode:

```powershell
npm.cmd run qa:v2:closeout
```

Check-only mode runs the same closeout checks but does not rewrite the tracked
Markdown report, which keeps the clean-worktree gate meaningful. Run without
`--check-only` only when intentionally refreshing
`docs/qa/v2-closeout-report.md`.

Manual checklist checkboxes mean tested and passed. If a V2 gate is accepted as
out of scope, use the checklist deferral controls and include the approver plus
rationale. The page and closeout audit both reject missing required run context
fields.

Before filling the V2 manual checklist, generate local context:

```powershell
npm.cmd run qa:v2:manual-context
```

This writes `.qa-runs/<run-id>-manual-context/report.md` with the current
commit, package version, Windows version, installer candidate, latest QA run
IDs, monitor topology from drag QA, and starter notes. It is only a prep
artifact; it does not mark any manual gate as passed. Paste the generated
`manual-context.json` into the manual checklist's context import box to prefill
fields without checking any gate.

Use `docs/qa/v2-manual-acceptance-runbook.md` while executing the checklist.
It maps every manual gate ID to the required physical action, evidence note,
and deferral rule.

Strict V2 closeout also requires a clean Git worktree. Use `--allow-dirty` only
for fixture smoke checks such as `npm.cmd run qa:v2:audit:smoke`; do not use it
for release closeout.

## Where Evidence Goes

Every desktop QA run writes artifacts under:

```text
.qa-runs/<run-id>/
```

The latest run path is recorded in:

```text
.qa-runs/latest.txt
```

Common artifacts:

- `report.md`
- `summary.json`
- `metadata.json`
- `events.jsonl`
- `console.log`
- scenario-specific screenshots and bounds files

`.qa-runs/` is intentionally gitignored. Do not commit routine run artifacts unless a curated artifact is needed for a PR or decision record.

## Reading a Report

Start with `report.md`.

Important fields:

- `Confidence`: whether the tested scope passed.
- `Evidence tier`: whether the test used Electron-internal evidence or OS-desktop evidence.
- `Exact claim allowed`: the strongest wording allowed after the run.
- `Uncovered Conditions`: what the run did not prove.

For example, the drag command may allow:

```text
passed automated drag smoke for tested Windows desktop scope; manual feel acceptance still separate
```

That does not mean every desktop environment or subjective feel has been validated.

## Future Feature Workflow

Before implementation, classify the change:

| Risk | Examples | Minimum QA |
| --- | --- | --- |
| P0 native desktop | Drag, click-through, bounds, tray, always-on-top, startup, persistence. | Relevant `qa:desktop:*` command plus manual acceptance when feel matters. |
| P1 interaction | Overlay care flows, Ball play, import/export, and in-place transient UI. | Desktop or renderer QA plus screenshots/state evidence. |
| P2 renderer | Panel routes, forms, layout, visual regressions. | `qa:renderer` or focused browser/renderer evidence. |
| P3 domain | Simulation, validation, package parsing, storage schemas. | Unit or integration tests. |

Use the template in `docs/qa/feature-qa-contract.md` for non-trivial features.

## Required Final Report Format

When closing future work, include:

- commands run
- pass/fail status
- artifact path
- tested scope
- environment
- confidence label
- uncovered conditions
- manual acceptance status
- exact claim allowed

Do not write broad claims like:

```text
dragging is fixed
```

Write scoped claims like:

```text
passed automated drag smoke for tested Windows desktop scope; manual feel acceptance still separate
```

## Manual Acceptance

Automation proves mechanical behavior under tested conditions. It does not fully prove desktop feel.

Use this form when subjective feel matters:

```text
automation_run_id:
manual_pass: yes/no
failed_step:
notes:
blocks_fixed_claim: yes/no
```

For drag, the manual check is:

1. Launch Deskagotchi.
2. Drag the pet three times in normal desktop use.
3. Click the pet and confirm the care menu opens.
4. Drag near a screen edge and confirm the pet remains recoverable.
5. Restart the app.
6. Confirm the pet returns to the last valid visible position.

If `blocks_fixed_claim` is `yes`, the feature cannot be described as fixed beyond the automated scope.

## Data Safety

Desktop QA runs use an isolated profile under `.qa-runs/<run-id>/profile`.

The harness sets Electron `userData` before runtime storage initializes, so QA should not touch the normal Deskagotchi save directory. If a report shows a real user data path instead of `.qa-runs/.../profile`, treat the run as failed.

## Troubleshooting

If a desktop QA command refuses to run, check whether a normal Deskagotchi instance is already open. The harness intentionally refuses to run when a non-QA app instance could interfere.

If drag results look wrong on a scaled display, inspect:

- `bounds-before.json`
- `bounds-after.json`
- `metadata.json`
- `events.jsonl`

The drag path accounts for `window.devicePixelRatio`; regressions here usually show up as a mismatch between pointer delta and native `BrowserWindow` bounds delta.

If Electron launches but the renderer bridge is missing, check the preload build output. The packaged preload must be CommonJS-compatible for the sandboxed Electron preload path.
