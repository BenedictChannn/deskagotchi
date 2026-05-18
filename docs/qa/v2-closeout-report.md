# Deskagotchi V2 Closeout Report

Generated: 2026-05-18T05:42:07.639Z

Completion status: **incomplete**

## Exact Current Claim

Deskagotchi V2 release closeout is incomplete; see the failing automated or manual evidence rows below.

## Concrete V2 Deliverables

- Companion surface: compact transparent pet overlay, in-place care controls, click and drag behavior.
- Built-in pet quality: Bao, Miso, Mochi, Peanut, and Puddles with coherent LCD assets and full animation rows.
- Food and item experience: icon-first feeding, recognizable food assets, and selected-food eating cues.
- Care simulation: deterministic, documented, day-scale progression with tested action effects and offline catch-up.
- Deferred custom surfaces: user-facing Hatch and custom pet import/export are out of the v0.1 promise while built-in package validation remains.
- Desktop hardening: launch, drag, recovery, multi-monitor bounds, always-on-top, sleep/wake, play, and cleanup evidence.
- Package and data safety: package validation, atomic saves, backup recovery, and relaunch persistence.
- Packaging readiness: Windows build, installer resources, release smoke, and idle CPU automated evidence.

## Automated Evidence

The evidence paths below are local `.qa-runs` artifacts. They are not committed
release artifacts; this report is the committed summary, and each row also
captures the source commit/freshness checks used by the audit.

| Area | Status | Latest evidence | Confidence | Notes |
| --- | --- | --- | --- | --- |
| Launch | PASS | .qa-runs/2026-05-18T05-38-26-004Z-35904-5c0ac088-launch/report.md | automated-pass | passed automated launch QA for tested scope |
| Drag and current multi-monitor layout | FAIL | .qa-runs/2026-05-15T04-07-43-837Z-46684-f255aa53-drag/report.md | automated-pass | passed automated drag smoke for tested Windows desktop scope; manual feel acceptance still separate<br />notable: OS drag crossed onto negative-coordinate monitor<br />QA run was captured with dirty app/source paths: .github/workflows/desktop-release-artifacts.yml, .husky/pre-commit, package.json, plan.md, scripts/qa/desktop-qa.mjs, scripts/qa/package-manager.mjs, scripts/qa/v2-closeout-audit.mjs, scripts/qa/v2-manual-acceptance-page-smoke.mjs, scripts/qa/v2-manual-context.mjs, scripts/qa/v2-manual-preflight.mjs |
| Overlay care interactions | FAIL | .qa-runs/2026-05-15T04-09-54-925Z-43512-fd9d366d-overlay/report.md | automated-pass | passed automated overlay QA for tested scope<br />QA run was captured with dirty app/source paths: .github/workflows/desktop-release-artifacts.yml, .husky/pre-commit, package.json, plan.md, scripts/qa/desktop-qa.mjs, scripts/qa/package-manager.mjs, scripts/qa/v2-closeout-audit.mjs, scripts/qa/v2-manual-acceptance-page-smoke.mjs, scripts/qa/v2-manual-context.mjs, scripts/qa/v2-manual-preflight.mjs |
| Ball play mode | FAIL | .qa-runs/2026-05-15T04-11-52-953Z-42760-78a70725-play/report.md | automated-pass | passed automated play QA for tested scope<br />QA run was captured with dirty app/source paths: .github/workflows/desktop-release-artifacts.yml, .husky/pre-commit, package.json, plan.md, scripts/qa/desktop-qa.mjs, scripts/qa/package-manager.mjs, scripts/qa/v2-closeout-audit.mjs, scripts/qa/v2-manual-acceptance-page-smoke.mjs, scripts/qa/v2-manual-context.mjs, scripts/qa/v2-manual-preflight.mjs |
| Lifecycle, always-on-top, resume, unlock | FAIL | .qa-runs/2026-05-15T15-25-31-834Z-1708-bf347c3f-release-lifecycle/report.md | automated-pass | passed automated lifecycle QA for tested scope<br />QA run was captured with dirty app/source paths: .github/workflows/desktop-release-artifacts.yml, package.json, pnpm-lock.yaml, scripts/qa/release-qa.mjs, scripts/qa/v2-closeout-audit-smoke.mjs, scripts/qa/v2-closeout-audit.mjs, scripts/qa/v2-scope-qa.mjs, src/main/index.ts, src/preload/index.ts, src/renderer/src/components/PanelApp.tsx, src/renderer/src/devDeskagotchiApi.ts, src/renderer/src/global.d.ts, src/renderer/src/main.tsx, src/shared/ipc.ts |
| Renderer panel routes | FAIL | .qa-runs/2026-05-15T04-16-09-721Z-44316-70e338f6-renderer/report.md | automated-pass | passed automated renderer QA for tested scope<br />QA run was captured with dirty app/source paths: .github/workflows/desktop-release-artifacts.yml, .husky/pre-commit, package.json, plan.md, scripts/qa/desktop-qa.mjs, scripts/qa/package-manager.mjs, scripts/qa/v2-closeout-audit.mjs, scripts/qa/v2-manual-acceptance-page-smoke.mjs, scripts/qa/v2-manual-context.mjs, scripts/qa/v2-manual-preflight.mjs |
| Five-minute idle CPU | FAIL | .qa-runs/2026-05-15T04-29-30-906Z-18128-eccb6375-idle/report.md | automated-pass | passed automated idle QA for tested scope<br />QA run was captured with dirty app/source paths: .github/workflows/desktop-release-artifacts.yml, .husky/pre-commit, package.json, plan.md, scripts/qa/desktop-qa.mjs, scripts/qa/package-manager.mjs, scripts/qa/v2-closeout-audit.mjs, scripts/qa/v2-manual-acceptance-page-smoke.mjs, scripts/qa/v2-manual-context.mjs, scripts/qa/v2-manual-preflight.mjs |
| Packaged release and installer smoke | FAIL | .qa-runs/2026-05-15T15-22-59-291Z-1708-eb79b418-release/report.md | automated-pass | packaged Windows build passed release smoke for tested scope<br />QA run was captured with dirty app/source paths: .github/workflows/desktop-release-artifacts.yml, package.json, pnpm-lock.yaml, scripts/qa/release-qa.mjs, scripts/qa/v2-closeout-audit-smoke.mjs, scripts/qa/v2-closeout-audit.mjs, scripts/qa/v2-scope-qa.mjs, src/main/index.ts, src/preload/index.ts, src/renderer/src/components/PanelApp.tsx, src/renderer/src/devDeskagotchiApi.ts, src/renderer/src/global.d.ts, src/renderer/src/main.tsx, src/shared/ipc.ts |
| Lint, typecheck, and unit tests | PASS | .qa-runs/2026-05-18T05-25-46-232Z-37936-b2a92ccb-check/report.md | automated-pass | lint, TypeScript checking, and unit tests passed for this checkout |
| Built-in pet asset QA | FAIL | .qa-runs/2026-05-15T04-18-23-081Z-41568-ed6b8edc-assets-pets/report.md | automated-pass | passed assets-pets static asset QA<br />QA run was captured with dirty app/source paths: .github/workflows/desktop-release-artifacts.yml, .husky/pre-commit, package.json, plan.md, scripts/qa/desktop-qa.mjs, scripts/qa/package-manager.mjs, scripts/qa/v2-closeout-audit.mjs, scripts/qa/v2-manual-acceptance-page-smoke.mjs, scripts/qa/v2-manual-context.mjs, scripts/qa/v2-manual-preflight.mjs |
| Food and item asset QA | FAIL | .qa-runs/2026-05-15T04-18-26-090Z-8540-674aab29-assets-items/report.md | automated-pass | passed assets-items static asset QA<br />QA run was captured with dirty app/source paths: .github/workflows/desktop-release-artifacts.yml, .husky/pre-commit, package.json, plan.md, scripts/qa/desktop-qa.mjs, scripts/qa/package-manager.mjs, scripts/qa/v2-closeout-audit.mjs, scripts/qa/v2-manual-acceptance-page-smoke.mjs, scripts/qa/v2-manual-context.mjs, scripts/qa/v2-manual-preflight.mjs |
| V2 visual acceptance pages | FAIL | .qa-runs/2026-05-15T04-18-29-004Z-21748-505c6629-visual-page/report.md | automated-pass | passed automated visual page smoke for tested browser scope; subjective pet and food recognizability still requires manual acceptance<br />QA run was captured with dirty app/source paths: .github/workflows/desktop-release-artifacts.yml, .husky/pre-commit, package.json, plan.md, scripts/qa/desktop-qa.mjs, scripts/qa/package-manager.mjs, scripts/qa/v2-closeout-audit.mjs, scripts/qa/v2-manual-acceptance-page-smoke.mjs, scripts/qa/v2-manual-context.mjs, scripts/qa/v2-manual-preflight.mjs |
| V2 user-facing scope | PASS | .qa-runs/2026-05-18T05-41-16-585Z-25072-5c818e0d-v2-scope/report.md | automated-pass | passed static V2 scope QA: Hatch/custom generation and v0.1 custom pet import/export are not exposed through user-facing UI, route, preload, or IPC surfaces |

## Prompt-To-Artifact Checklist

| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Launch opens the compact transparent pet overlay by default. | PASS | latest launch QA report |  |
| Normal care actions stay in the overlay and health does not open a stuck panel. | FAIL | latest overlay QA report | missing automated pass: overlay |
| Feed picker uses icon-first food choices and selected food appears in eating feedback. | MANUAL OPEN | overlay QA plus item contact sheets | missing automated pass: overlay<br />missing automated pass: assets-items<br />missing automated pass: visual-page<br />manual acceptance required for release closeout: manual-open |
| Ball play expands to the monitor work area and restores the compact overlay. | FAIL | latest play QA report | missing automated pass: play |
| Pet dragging works by the visible sprite and persists restored bounds. | MANUAL OPEN | latest drag QA report | missing automated pass: drag<br />manual acceptance required for release closeout: manual-open |
| Multi-monitor bounds logic covers right, left, stacked, largest-intersection, and fallback layouts. | PASS | src/main/windowBounds.test.ts through pnpm run check |  |
| Built-in roster and animation assets are ready for Bao, Miso, Mochi, Peanut, and Puddles. | MANUAL OPEN | pet asset contact sheets and visual acceptance page | missing automated pass: assets-pets<br />missing automated pass: visual-page<br />manual acceptance required for release closeout: manual-open |
| Care simulation is deterministic, documented, and tested for V2 rules. | PASS | simulation docs and test suite through pnpm run check |  |
| Package validation and persistence safety remain covered by the checked test suite. | PASS | package, runtime, and storage tests through pnpm run check |  |
| Custom generation and custom pet import/export are deferred from user-facing v0.1. | PASS | README, renderer route removal, IPC bridge removal, and V2 scope QA |  |
| Always-on-top, reset position, resume, unlock, and startup setting safety are covered. | FAIL | latest lifecycle QA report | missing automated pass: lifecycle |
| Low idle CPU has a five-minute automated observation. | FAIL | latest idle QA report | missing automated pass: idle |
| Windows packaging includes runtime resources and installer smoke evidence. | MANUAL OPEN | latest release QA report | missing automated pass: release<br />manual acceptance required for release closeout: manual-open |

## Workspace State

Status: **PASS**

Commit: `8a4332b`

Workspace is clean.

Dirty entries: 0

- None

## Required Artifacts

| Artifact | Status | Path |
| --- | --- | --- |
| V2 goal success criteria | PASS | `docs/v2-goal-success-criteria.md` |
| V2 roadmap | PASS | `docs/qa/deskagotchi-v2-roadmap.html` |
| V2 completion audit | PASS | `docs/qa/v2-completion-audit.md` |
| Desktop hardening plan | PASS | `docs/qa/desktop-hardening-v2.md` |
| Simulation maintenance docs | PASS | `docs/simulation/care-simulation-v2.md` |
| Food icon standards | PASS | `docs/design/lcd-food-icon-standards.md` |
| Pet animation gallery | PASS | `docs/qa/pet-animation-gallery.html` |
| V2 visual acceptance page | PASS | `docs/qa/v2-visual-acceptance.html` |
| V2 visual acceptance screenshot | PASS | `docs/qa/v2-visual-acceptance-screenshot.png` |
| V2 visual review notes | PASS | `docs/qa/v2-visual-review-notes.md` |
| Food icon contact sheet | PASS | `docs/qa/lcd-food-icons-contact-sheet.png` |
| Full item icon contact sheet | PASS | `docs/qa/lcd-item-icons-contact-sheet.png` |
| Bao contact sheet | PASS | `docs/qa/bao-contact-sheet.png` |
| Miso contact sheet | PASS | `docs/qa/miso-contact-sheet.png` |
| Mochi contact sheet | PASS | `docs/qa/mochi-contact-sheet.png` |
| Peanut contact sheet | PASS | `docs/qa/peanut-contact-sheet.png` |
| Puddles contact sheet | PASS | `docs/qa/puddles-contact-sheet.png` |

## Required Manual Acceptance

Status: **manual-open**

Evidence path: not exported yet

No exported manual acceptance JSON found.

- Manual gate not exported: environment.rdp: RDP behavior is acceptable or explicitly deferred.
- Manual gate not exported: environment.smartscreen: SmartScreen/signing caveat is documented for this build.
- Manual gate not exported: environment.taskbar: Unusual taskbar layout is acceptable or explicitly deferred.
- Manual gate not exported: installer.install: Interactive installer completes without confusing or broken UI.
- Manual gate not exported: installer.launch: Installed app launches to the pet overlay.
- Manual gate not exported: installer.uninstall: Interactive uninstall removes the installed executable.
- Manual gate not exported: monitors.dpi: Mixed-DPI drag and restore behavior is acceptable.
- Manual gate not exported: monitors.right: Right-side monitor layout works.
- Manual gate not exported: monitors.stacked: Stacked-above or stacked-below layout works.
- Manual gate not exported: sleep.process: No duplicate or stuck Deskagotchi processes remain.
- Manual gate not exported: sleep.state: Stats/state refresh after wake.
- Manual gate not exported: sleep.visible: Pet remains visible or recoverable after wake.
- Manual gate not exported: startup.disable: Startup is disabled again after the test.
- Manual gate not exported: startup.enable: Packaged app registers startup after enabling the setting.
- Manual gate not exported: startup.login: App opens once after login/restart.
- Manual gate not exported: visual.animations: Animation rows have visible but not distracting movement.
- Manual gate not exported: visual.cohesion: Pets and food share a coherent monochrome LCD style.
- Manual gate not exported: visual.food: Food icons are roughly identifiable without relying on labels.
- Manual gate not exported: visual.pets: All five pets read as intended animals at desktop size.

## Strict Mode

Run the release closeout gate before publishing a release:

```powershell
pnpm run qa:v2:closeout
```

Run the automated-only closeout when refreshing non-release evidence summaries:

```powershell
pnpm run qa:v2:automated-closeout
```

Use `--check-only` for final release validation so the tracked report does not
get rewritten during the clean-worktree gate. Run without `--check-only` when
you intentionally want to refresh this Markdown report artifact.

Optional manual acceptance files can still be audited separately when needed:

```powershell
pnpm run qa:v2:audit --manual C:\path\to\v2-manual-acceptance-export.json
```

Use a separate report path for fixture or release-candidate checks:

```powershell
pnpm run qa:v2:audit --manual C:\path\to\v2-manual-acceptance-export.json --report .qa-runs\v2-closeout-report.md
```

Use `--allow-dirty` only for fixture smoke checks that intentionally run
against a dirty local tree.

Strict release mode exits non-zero until automated evidence, required artifacts, manual acceptance, and the workspace are all passing.
