# Deskagotchi V2 Completion Audit

Last updated: 2026-05-11.

This audit maps the V2 goal to concrete evidence. V2 is not complete until every
blocking gap is either tested or explicitly accepted as out of scope.

For a machine-generated view of the latest local evidence, run:

```powershell
npm.cmd run qa:v2:audit
```

The generated report is written to `docs/qa/v2-closeout-report.md`. Use
`npm.cmd run qa:v2:closeout` when preparing a release branch so the final
closeout check does not rewrite the tracked report while it verifies the clean
worktree gate. Strict mode exits non-zero until automated evidence, required
artifacts, and manual acceptance JSON are all present and passing.

When the manual acceptance JSON was downloaded outside the repository, pass it
directly:

```powershell
npm.cmd run qa:v2:audit -- --manual C:\path\to\v2-manual-acceptance-export.json
```

## Objective

Ship Deskagotchi V2 as a usable Windows-first desktop pet companion with:

- Polished built-in pets.
- Recognizable food and care interactions.
- Documented deterministic care simulation.
- User-facing custom generation deferred.
- Verified desktop hardening across launch, drag, lifecycle, multi-monitor,
  always-on-top, sleep/wake, play, packaging, and recovery behavior.

## Current Automated Evidence

| Area | Evidence | Current status |
| --- | --- | --- |
| Lint, typecheck, unit tests | `npm.cmd run check` | Passed, 59 tests. |
| Full automated QA gate | `npm.cmd run qa` | Passed; includes launch, drag, overlay, play, lifecycle, renderer, pet assets, item assets, V2 scope, visual page, and manual acceptance page smoke. |
| Launch | `.qa-runs/2026-05-11T10-28-00Z-launch/report.md` | Passed. |
| Drag and negative-coordinate monitor | `.qa-runs/2026-05-11T09-42-57Z-drag/report.md` | Passed on the current two-monitor layout with a left-side negative-coordinate display. |
| Multi-monitor geometry | `src/main/windowBounds.test.ts` through `npm.cmd run check` | Pure bounds coverage for right-side, negative-coordinate, stacked-above, stacked-below, largest-intersection, and fallback layouts. |
| Overlay care UI | `.qa-runs/2026-05-11T10-49-46Z-overlay/report.md` | Passed with updated food atlas and selected-food eating cues. |
| Ball play mode | `.qa-runs/2026-05-11T09-43-29Z-play/report.md` | Passed. |
| Lifecycle, always-on-top, resume, unlock, startup setting safety | `.qa-runs/2026-05-11T10-27-25Z-lifecycle/report.md` | Passed. |
| Renderer panel routes | `.qa-runs/2026-05-11T09-43-55Z-renderer/report.md` | Passed. |
| Packaged release and installer smoke | `.qa-runs/2026-05-11T10-57-21Z-release/report.md` | Passed; includes packaged launch, packaged lifecycle recovery, current source resource byte checks, silent install, installed launch, and silent uninstall. |
| Five-minute idle CPU | `.qa-runs/2026-05-11T07-37-17Z-idle/report.md` | Passed at 2.61 percent of one CPU core over 300 seconds. |
| Pet package validation | `npm.cmd run validate:pets` through full QA | Passed. |
| Pet asset contact sheets | `docs/qa/*-contact-sheet.png` | Present for Bao, Miso, Mochi, Peanut, and Puddles. |
| Food/item icon contact sheets | `docs/qa/lcd-food-icons-contact-sheet.png`, `docs/qa/lcd-item-icons-contact-sheet.png` | Present and regenerated. |
| Combined visual acceptance surface | `docs/qa/v2-visual-acceptance.html`, `docs/qa/v2-visual-acceptance-screenshot.png`, `.qa-runs/2026-05-11T10-49-32Z-visual-page/report.md` | Generated from current pet and item manifests; browser smoke confirms current pet cards, food sheets, gallery animation cells, controls, and image paths render. |
| Manual acceptance form | `docs/qa/v2-manual-acceptance.html`, `docs/qa/v2-manual-acceptance-screenshot.png`, `npm.cmd run qa:v2:manual-page` | Ready for remaining physical/manual signoff and JSON export; browser smoke confirms gate counts, required run context blocking, stale-context reset behavior, deferral approver blocking, export JSON, and screenshot rendering. |

## Prompt-To-Artifact Checklist

| Requirement | Evidence | Gap |
| --- | --- | --- |
| Transparent frameless pet overlay launches by default | Launch QA report and screenshots | None known. |
| Normal care actions stay in overlay | Overlay QA report | None known. |
| Feed, play, clean, medicine, sleep, petting, and health work from overlay | Overlay and play QA reports | Manual feel still useful. |
| Pet draggable by visible sprite | Drag QA report and pure bounds tests | Right-side and stacked physical monitor layouts remain untested. |
| Dragging does not open care menu | Drag QA report | None known. |
| Built-in roster includes Bao, Miso, Mochi, Peanut, Puddles | Resource packages and pet QA | Final subjective visual acceptance still needed. |
| Pet animation rows exist and render | Pet validation, asset QA, contact sheets | Final subjective visual acceptance still needed. |
| Food choices are icon-first and selected food renders while eating | Overlay QA and item contact sheets | Final recognizability acceptance still needed. |
| Deterministic simulation is documented | `docs/simulation/care-simulation-v2.md` | Keep updated with future rule changes. |
| Offline progression, low-maintenance mode, deadlines, action effects, growth, and storage have tests | `npm.cmd run check` | None known for current scope. |
| Hatch/custom generation deferred | README, roadmap, `PanelView`, IPC channel surface, `npm.cmd run qa:v2:scope` | User-facing generation has no panel route, preload API, IPC channel, panel tab, or overlay action; archived local draft helpers remain as package-boundary research code. |
| Always-on-top persists across relaunch | Lifecycle QA | None known. |
| Sleep/wake resume and unlock refresh simulation | Lifecycle QA synthetic `powerMonitor` checks | Real machine sleep/wake manual pass still useful. |
| Frozen-window/process cleanup | Desktop QA process cleanup checks | RDP and unusual taskbar behavior untested. |
| Multi-monitor support | Pure bounds tests and left-side monitor drag QA | Right-side and stacked physical layouts still require manual or hardware-specific QA. |
| Ball play uses monitor work area and restores compact overlay | Play QA | None known. |
| Package safety and data safety | Runtime/package/storage tests and release QA | None known for current local scope. |
| Windows installer builds | `qa:release`, `docs/qa/v2-manual-acceptance.html` | Silent install/uninstall passes; interactive UI not manually accepted. |
| Installed app launches | `qa:release` installed executable smoke | None known. |
| Uninstaller works | `qa:release` silent uninstall smoke | Interactive uninstall UI not manually accepted. |
| Startup-on-boot setting | Lifecycle QA verifies persistence and QA/dev native-mutation skip | Real packaged login/restart behavior untested. |
| Low idle CPU | Five-minute idle QA | Manual Task Manager observation optional but still useful. |

## Blocking Gaps

- Final visual acceptance for pets and food icons. `docs/qa/v2-visual-acceptance.html`
  is ready for signoff, but the signoff itself is still manual.
- Interactive installer UI and interactive uninstall UI.
- Real packaged startup-on-login after Windows login or restart.
- Right-side and stacked physical monitor layouts.
- RDP-specific behavior.
- Unusual taskbar layouts.
- SmartScreen/signing reputation caveat.

Use `docs/qa/v2-manual-acceptance.html` to record these remaining checks. The
closeout report now lists every unresolved manual gate by checklist ID and
label until the exported JSON resolves it. The manual page itself blocks
`manualPass` until the required run context fields are filled. Paste the
exported JSON into this audit or the release PR before making a V2 complete
claim.

## Exact Current Claim

The current branch has strong automated evidence for the tested Windows scope,
including packaged release smoke and five-minute idle CPU. It is not yet a full
V2 completion claim because several manual and physical desktop acceptance
items remain open.
