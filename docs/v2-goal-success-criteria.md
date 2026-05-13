# Deskagotchi V2 Goal And Success Criteria

## Goal

Ship Deskagotchi V2 as a usable Windows-first desktop pet companion.

V2 means the app is no longer just a prototype. It should feel like a small
living creature on the laptop: draggable, recoverable, visually cohesive,
pleasant to care for, persistent over real time, and reliable across normal
desktop behavior.

## Explicit Non-Goal

User-facing custom pet generation is not part of the V2 promise.

Hatch/custom generation remains deferred research until we design the full
generation, approval, QA, packaging, moderation, and failure-recovery pipeline.
V2 should preserve safe package validation and import/export boundaries, but it
should not depend on generated custom pets.

## V2 Success Criteria

Each criterion must have concrete evidence. Do not mark V2 complete based on
subjective confidence alone.

### 1. Companion Surface

Success means the pet overlay is the primary experience.

Verifiable criteria:

- Launching the app opens only the compact transparent pet overlay by default.
- Normal care actions do not open the full management panel.
- Feed, play, clean, medicine, sleep/lights, petting, and health all work from
  the overlay.
- Buttons and status affordances do not cover the pet in its normal resting
  state.
- The pet can be clicked to open care controls.
- The pet can be dragged by the visible sprite.
- Dragging does not trigger the care menu.

Evidence required:

- `corepack pnpm run qa:desktop:launch`
- `corepack pnpm run qa:desktop:overlay`
- `corepack pnpm run qa:desktop:drag`
- Manual acceptance note for pet click/drag feel.

### 2. Built-In Pet Quality

Success means built-in pets are good enough to ship without custom generation.

Verifiable criteria:

- The V2 roster includes Bao, Miso, Mochi, Peanut, and Puddles.
- Each built-in pet has a valid package manifest.
- Each built-in pet has preview, icon, and spritesheet assets.
- Each built-in pet has the V2 animation row set:
  - idle
  - happy
  - sad
  - hungry
  - eating
  - playing
  - sleeping
  - sick
  - cleaning
  - walking
  - attention
- Each animation row has visible movement or expression change.
- Pet silhouettes remain readable at overlay size.
- Frame size and anchor consistency are acceptable across rows.

Evidence required:

- `corepack pnpm run validate:pets`
- `corepack pnpm run qa:assets:pets`
- Updated `docs/qa/pet-animation-gallery.html`
- Per-pet contact sheet review notes when assets change.

### 3. Food And Item Experience

Success means food selection is useful and visually understandable.

Verifiable criteria:

- Each pet has species-appropriate favorite or liked foods.
- Shared foods remain simple and broadly usable.
- Food icons are roughly identifiable without reading labels.
- Feed picker uses clear icon-first item choices.
- The selected food renders as an eating cue near the pet's configured anchor.
- Eating different foods applies item effects and pet preference modifiers.

Evidence required:

- `corepack pnpm run generate:items` after item-source changes.
- `corepack pnpm run qa:assets:items`
- Review of `docs/qa/lcd-food-icons-contact-sheet.png`
- Feed picker smoke evidence.
- Eating screenshots or QA artifacts for all built-in pets.
- `docs/design/lcd-food-icon-standards.md` stays current.

### 4. Care Simulation

Success means the care loop is documented, deterministic, and meaningful over
days.

Verifiable criteria:

- Simulation rules are documented in `docs/simulation/care-simulation-v2.md`.
- Every simulation rule change updates that document.
- Constants are centralized, not scattered through UI components.
- Offline progression is deterministic and capped fairly.
- Age and life stage progression are measured in days.
- Care quality affects growth or evolution outcome.
- Sickness, mess, sleep, play, affection, and missed care have clear effects.
- Mood derivation maps to reachable animation states.

Evidence required:

- Unit tests for action effects.
- Unit tests for offline catch-up below and above cap.
- Unit tests for clock rollback.
- Unit tests for care deadlines and missed care.
- Unit tests for sleep/wake and sickness behavior.
- Unit tests for growth/evolution branch selection.
- `corepack pnpm run test`
- `corepack pnpm run typecheck`

### 5. Desktop Hardening

Success means Deskagotchi is reliable as a native desktop companion.

Verifiable criteria:

- Closing the overlay does not leave an unclosable frozen window.
- Explicit quit removes the overlay and shuts down normal app processes.
- Tray show/hide/reset position can recover the pet.
- Saved bounds restore to a visible area.
- Drag works across primary, adjacent, negative-coordinate, and stacked monitor
  layouts where available.
- DPI scaling does not break drag deltas or bounds restoration.
- Always-on-top obeys settings and persists across relaunch.
- Sleep/wake/resume/unlock progresses simulation and refreshes renderer state.
- Ball play expands to the monitor work area and restores compact overlay bounds
  on X or Escape.
- Click-through state never leaves the pet permanently unclickable.

Evidence required:

- `corepack pnpm run qa:desktop:launch`
- `corepack pnpm run qa:desktop:drag`
- `qa:desktop:drag` artifact `display-topology.json` and cross-monitor bounds
  artifacts when a negative-coordinate monitor is available.
- `corepack pnpm run qa:desktop:play`
- `corepack pnpm run qa:desktop:lifecycle`
- Manual acceptance form from `docs/qa/desktop-hardening-v2.md`
- Process cleanup check after quit.

### 6. Package And Data Safety

Success means pet packages and local state are safe enough for local use.

Verifiable criteria:

- Built-in and imported packages use the same package schema.
- Pet state and package metadata remain separate.
- Unsafe archive paths are rejected.
- Executable/script payloads are rejected.
- Oversized entries or zip expansion abuse are rejected.
- Invalid manifests are rejected before install.
- Duplicate custom package ids are handled safely.
- Save files are written atomically.
- Backup recovery works for corrupted saves.
- State survives app relaunch.

Evidence required:

- Package validation tests.
- Runtime import/export tests.
- Storage tests.
- `corepack pnpm run validate:pets`
- `corepack pnpm run test`

### 7. Packaging And Release Readiness

Success means the app can be installed and operated locally on Windows.

Verifiable criteria:

- Production build completes.
- Windows installer can be built.
- Runtime resources are included.
- Large generation artifacts are not packaged unnecessarily.
- Local data path is documented.
- Startup-on-boot setting persistence is covered in QA, native mutation is
  skipped during QA/dev, and packaged OS startup is manually validated or
  explicitly marked not ready.
- Idle behavior does not show sustained excessive CPU usage during a manual
  five-minute idle observation.

Evidence required:

- `corepack pnpm run build`
- `corepack pnpm run package:win`
- `corepack pnpm run qa:release`
- `DESKAGOTCHI_IDLE_SECONDS=300 corepack pnpm run qa:desktop:idle`
- Installer smoke evidence from `qa:release`, including silent install,
  installed executable launch, and silent uninstall.
- Manual idle observation note.
- Local data path verification.

## Required V2 Closeout Gate

Do not call V2 complete until all of these pass or have an explicit documented
exception:

```powershell
corepack pnpm run check
corepack pnpm run validate:pets
corepack pnpm run qa
corepack pnpm run package:win
corepack pnpm run qa:release
DESKAGOTCHI_IDLE_SECONDS=300 corepack pnpm run qa:desktop:idle
corepack pnpm run qa:v2:scope
corepack pnpm run qa:v2:visual-page
corepack pnpm run qa:v2:audit:smoke
corepack pnpm run qa:v2:closeout
```

Required manual evidence:

- `corepack pnpm run qa:v2:manual-context` output can be used to prefill build,
  installer, latest QA run, monitor, and evidence-note context. This helper is
  not a pass condition by itself.
- `docs/qa/v2-manual-acceptance.html` export with every required gate either
  passed or explicitly deferred with approver and rationale.
- Food icon recognizability review against
  `docs/qa/lcd-food-icons-contact-sheet.png`.
- Pet animation gallery review against
  `docs/qa/pet-animation-gallery.html`.
- Installer launch, install, startup, and uninstall acceptance.
- Multi-monitor, high-DPI, sleep/wake, RDP, taskbar, and SmartScreen
  acceptance where available in the test environment.

`corepack pnpm run qa:v2:closeout` is the final gate. It runs the closeout audit in
strict check-only mode, so it must not rewrite tracked evidence and it must fail
until the manual acceptance JSON is present and passing.

## Exact Completion Claim

Allowed only when the closeout gate passes:

```text
Deskagotchi V2 is complete for the tested Windows desktop scope: built-in pet
care, overlay interactions, assets, simulation, package safety, desktop
hardening, QA, build, and installer checks have verifiable evidence.
```

If any manual desktop condition is not tested, use a narrower claim.
