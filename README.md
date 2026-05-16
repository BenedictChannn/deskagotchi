# Deskagotchi

Deskagotchi is a Windows-first desktop virtual pet companion built with Electron, React, TypeScript, Vite, and a manifest-driven pet package system.

The app runs as a small transparent frameless pet window with tray controls, local persistence, deterministic real-time care simulation, and built-in original pets.

## Current Capabilities

- Transparent frameless pet overlay window.
- Tray menu with show, hide, reset position, feed, play, clean, sleep, health, pet selector, settings, and quit.
- Single-instance app behavior.
- Multi-monitor-safe position recovery.
- Crash-safe local save file with backup recovery.
- Deterministic simulation with offline progression caps.
- Stats for hunger, happiness, energy, cleanliness, health, affection, discipline, age, weight, mood, care history, illness, and messes.
- Built-in original pet roster:
  - Bao, a shih tzu companion
  - Miso, a cat companion
  - Mochi, a monkey companion
  - Peanut, an elephant companion
  - Puddles, a duck companion with peas and corn as favorite foods
- Built-in pets ship with the full MVP animation row set and pet-specific food preferences.
- Built-in pets use a manifest-driven package schema.
- Package validation for manifest structure, safe paths, missing assets, unsupported files, and executable payloads.
- Hatch/custom pet generation is deferred for V2 and custom pet import/export is not exposed in v0.1.
- Settings for always-on-top, startup, sound, reduced motion, low maintenance, and notifications.

## Desktop App Downloads

v0.1 release downloads should include the Windows desktop build:

- Windows installer: `Deskagotchi Setup <version>.exe`
- macOS is not published for v0.1 unless a real macOS smoke pass is completed.

See `docs/desktop-app.md` for download, install, first-run, usage,
troubleshooting, and release-publisher instructions.

Use `docs/qa/v2-pr-readiness.md` as the V2 pull request and release artifact
checklist.

The `Desktop Release Artifacts` GitHub Actions workflow builds the Windows
installer on manual runs and publishes it to GitHub Releases for matching `v*`
tags after release smoke passes.

## Install

Use Node.js `>=22.13 <25`. Install pnpm `11.1.1` once so `pnpm` is on
your PATH. CI uses `pnpm/action-setup`; locally, use your preferred pnpm
installer and confirm the pinned version:

```powershell
pnpm --version
```

Then install dependencies from the lockfile:

```powershell
pnpm install --frozen-lockfile
```

## Run

```powershell
pnpm run dev
```

The pet opens as a transparent desktop overlay. Use the tray icon to recover the pet window, open settings, or quit.

During dev, the renderer is pinned to `http://localhost:5187` so browser-based checks do not collide with other Vite apps. With `pnpm run dev` running, open these routes for renderer feedback:

```text
http://localhost:5187/#/panel/status
http://localhost:5187/#/panel/pet-selector
http://localhost:5187/#/panel/settings
http://localhost:5187/#/
```

## Validate

```powershell
pnpm run check
```

This runs ESLint, TypeScript typechecking, and the Vitest suite.

The pre-commit hook runs the faster gate:

```powershell
pnpm run precommit
```

That checks linting and TypeScript before Git accepts a commit.

Validate committed pet packages:

```powershell
pnpm run validate:pets
```

Run the full local QA gate:

```powershell
pnpm run qa
```

The QA gate launches Deskagotchi with an isolated profile, exercises desktop
and renderer flows, and writes evidence under `.qa-runs/<run-id>/`. See
`docs/qa/using-qa.md` for when to run each targeted QA command and how to
interpret the reports.

Verify that deferred Hatch/custom generation and custom pet import/export have
not returned to the user-facing v0.1 surface:

```powershell
pnpm run qa:v2:scope
```

Smoke-test the visual acceptance and pet animation gallery pages:

```powershell
pnpm run qa:v2:visual-page
```

Current pet and food visual review notes live in:

```text
docs/qa/v2-visual-review-notes.md
```

Run the idle CPU observation separately because it intentionally waits:

```powershell
pnpm run qa:desktop:idle
```

Set `DESKAGOTCHI_IDLE_SECONDS=300` for the V2 five-minute idle observation.

Run release QA after packaging changes:

```powershell
pnpm run qa:release
```

This rebuilds the Windows installer, checks that packaged resources include the
runtime pet and item assets, launches `release/win-unpacked/Deskagotchi.exe`,
silently installs into `.qa-runs/`, launches the installed executable, and runs
the generated uninstaller.

Generate the V2 closeout report from the latest QA evidence:

```powershell
pnpm run qa:v2:audit
```

This writes `docs/qa/v2-closeout-report.md`. Use strict check-only mode on a
release branch so final validation does not rewrite the tracked report while it
checks the clean worktree gate:

```powershell
pnpm run qa:v2:closeout
```

Strict mode exits non-zero until automated evidence, required artifacts, and the
workspace are clean. Manual acceptance evidence is advisory for the current V2
audit and can still be supplied with `--manual`.

If the manual checklist JSON is downloaded outside the repo, pass it directly:

```powershell
pnpm run qa:v2:audit --manual C:\path\to\v2-manual-acceptance-export.json
```

Smoke-test the audit's strict-mode behavior without changing the real closeout
report:

```powershell
pnpm run qa:v2:audit:smoke
```

Smoke-test the manual acceptance page export logic and refresh its screenshot:

```powershell
pnpm run qa:v2:manual-page:update
```

Routine `pnpm run qa:v2:manual-page` runs without changing tracked
screenshots and writes `.qa-runs/<run-id>-manual-page/` evidence for the V2
closeout audit.

Manual checklist checkboxes mean the gate was tested and passed. If a gate is
accepted as out of scope for V2, mark its deferral in the checklist and fill in
the approver plus rationale. The manual page and closeout audit both require
the run context fields before `manualPass` can be true. Strict V2 closeout also
requires a clean Git worktree so QA evidence is not claimed against uncommitted
local changes. Use `--check-only` for the final release gate; run without it
only when intentionally refreshing the Markdown closeout report.

Generate a helper report before filling the manual V2 checklist:

```powershell
pnpm run qa:v2:manual-context
```

This writes `.qa-runs/<run-id>-manual-context/report.md` with the current build,
installer candidate, latest QA run IDs, monitor topology, and starter evidence
notes. Paste the generated `manual-context.json` into the manual checklist's
context import box to prefill fields. It is manual-prep only and does not mark
any manual gate as passed. Do not hand-edit the generated build or installer
path fields in the manual export; strict closeout verifies that the build
contains the current `package.json` version, a real Git commit from this
repository, and the same build plus installer path embedded in the manual
context signature. Once that build is tested, keep post-test commits to
documentation/evidence files; app, package, source, or asset changes require
regenerating the context and retesting the affected gates.

Regenerate LCD item icons:

```powershell
pnpm run generate:items
```

Regenerate the V2 visual acceptance page:

```powershell
pnpm run generate:visual-qa
```

Use the manual V2 checklist for physical acceptance work:

```text
docs/qa/v2-manual-acceptance.html
```

Use the manual V2 runbook while executing the checklist:

```text
docs/qa/v2-manual-acceptance-runbook.md
```

The checklist can download `v2-manual-acceptance-export.json`. Keep that JSON
with the release evidence or pass it to the V2 audit with `--manual`.

Regenerate the desktop app icons:

```powershell
pnpm run generate:icon
```

The canonical icon source is `build/icon-source.png`; generated packaging
outputs are `build/icon.png`, `build/icon.ico`, and `build/icon.icns`. See
`docs/design/app-icon.md` for the imagegen prompt and icon acceptance notes.

## Build

```powershell
pnpm run build
```

Build a Windows installer:

```powershell
pnpm run package:win
```

Build macOS DMG and zip artifacts on macOS for local smoke testing only:

```bash
pnpm run package:mac
```

Unsigned Windows builds may trigger SmartScreen warnings until the binary has signing and reputation.
Unsigned or unnotarized macOS builds may require Finder's Open flow on first launch.

For v0.1, publish release notes that state whether the Windows installer is
signed or unsigned, include the SHA256 checksum for the attached installer, and
describe the exact QA scope used for the release candidate.

## Local Data

Runtime state is stored under Electron's `app.getPath("userData")` directory.

The app stores:

- `deskagotchi-save.json`
- `deskagotchi-save.backup.json`
- reserved internal package directories, if created by older development builds

The settings panel displays the resolved local data path. Deskagotchi v0.1 does
not require an account, analytics, telemetry, or remote sync.

## Pet Package Format

Each pet package is a directory containing:

```text
pet.json
spritesheet.png
preview.png
icon.png
```

The MVP runtime accepts `.svg`, `.png`, and `.webp` assets. The monochrome LCD
production path should use lightweight transparent `.png` atlases; legacy SVGs
are still accepted for placeholder pets.

Built-in imagegen-derived pets may also include `source-metadata.json`. Keep
large source concepts and contact sheets under `docs/qa/` so the packaged app
does not carry unnecessary generation artifacts.

Important `pet.json` fields:

- `schemaVersion`
- `packageId`
- `packageVersion`
- `minAppVersion`
- `name`
- `description`
- `source`
- `species`
- `personality`
- `createdAt`
- `assetVersion`
- `assets`
- `animations`
- `growthStages`
- `preferredFoods`
- `dislikedFoods`
- `foodPreferences`
- `favoritePlayStyle`
- `careModifiers`
- `colorPalette`
- `author`
- `license`
- `capabilities`
- `validationStatus`
- `assetHash`
- `generation`

Imported packages are treated as untrusted. Archives are rejected if they contain unsafe paths, oversized entries, executable/script files, invalid manifests, missing assets, duplicate package ids, or wrong package source metadata.

## Deferred Hatch Research

User-facing Hatch/custom pet generation and custom pet import/export are
archived for the v0.1 release path. Earlier prototype code proved local package
mechanics, but a real custom pet flow still needs a full generation, approval,
QA, packaging, moderation, and failure-recovery design before it should be
exposed in the app.

The image generation replacement path should use the `$imagegen` skill:

1. Generate a canonical base pet first.
2. Generate growth stages and animation rows from that approved base.
3. Use a flat chroma-key background first for transparent assets.
4. Remove the background locally with the installed chroma-key helper.
5. Validate frame size, row count, alpha, transparent corners, padding, manifest references, contact sheet, and small-size silhouette.
6. Install only after the package validator passes.

Do not copy Bandai, Tamagotchi, Codex pet characters, names, logos, shell designs, or proprietary assets.

## Extending the Built-In Roster

Preferred flow:

1. Generate or select an approved base concept with `$imagegen`.
2. Build the animation rows from that approved concept, keeping a flat chroma-key background until cleanup.
3. Copy the final `spritesheet.png`, `preview.png`, `icon.png`, and source metadata into `resources/pets/<package-id>/`.
4. Add any pet-specific foods to `scripts/generate-lcd-item-icons.mjs`, then run `pnpm run generate:items`.
5. Run `pnpm run validate:pets`, `pnpm run qa:assets:pets`, and `pnpm run qa:assets:items`.
6. Keep `pet.json` schema-compatible with `src/shared/domain.ts`.

For a fully featured built-in pet, include:

- Egg, baby, child, teen, and adult growth stages.
- At least idle, happy, walking, sleeping, and sick animations.
- Prefer the full animation set:
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

## Architecture

- `src/main/`: Electron main process, tray, windows, persistence, package registry, and archived Hatch draft research code.
- `src/preload/`: Typed IPC bridge.
- `src/renderer/`: Overlay and panel React UI.
- `src/shared/`: Domain schemas, archived Hatch validation, package validation, IPC types, deterministic simulation.
- `resources/pets/`: Built-in pet packages.
- `resources/items/`: Built-in item icon atlases and care item manifests.
- `scripts/`: App icon, item atlas, and QA utility scripts.

The simulation engine is framework-agnostic and uses injected time so offline progression and evolution can be tested deterministically.
