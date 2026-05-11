# Deskagotchi

Deskagotchi is a Windows-first desktop virtual pet companion built with Electron, React, TypeScript, Vite, and a manifest-driven pet package system.

The app runs as a small transparent frameless pet window with tray controls, local persistence, deterministic real-time care simulation, built-in original pets, and local custom pet import/export boundaries.

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
- Shared package schema for built-in and custom pets.
- Package validation for manifest structure, safe paths, missing assets, unsupported files, and executable payloads.
- Hatch/custom pet generation is deferred for V2 while the package validation and import/export boundary stays in place.
- Custom pet import/export as `.deskagotchi-pet`.
- Settings for always-on-top, startup, sound, reduced motion, low maintenance, and notifications.

## Install

```powershell
npm.cmd install
```

Use `npm.cmd` on Windows if PowerShell blocks npm shims.

## Run

```powershell
npm.cmd run dev
```

The pet opens as a transparent desktop overlay. Use the tray icon to recover the pet window, open settings, or quit.

During dev, the renderer is pinned to `http://localhost:5187` so browser-based checks do not collide with other Vite apps. With `npm.cmd run dev` running, open these routes for renderer feedback:

```text
http://localhost:5187/#/panel/status
http://localhost:5187/#/panel/pet-selector
http://localhost:5187/#/panel/settings
http://localhost:5187/#/
```

## Validate

```powershell
npm.cmd run check
```

This runs ESLint, TypeScript typechecking, and the Vitest suite.

The pre-commit hook runs the faster gate:

```powershell
npm.cmd run precommit
```

That checks linting and TypeScript before Git accepts a commit.

Validate committed pet packages:

```powershell
npm.cmd run validate:pets
```

Run the full local QA gate:

```powershell
npm.cmd run qa
```

The QA gate launches Deskagotchi with an isolated profile, exercises desktop
and renderer flows, and writes evidence under `.qa-runs/<run-id>/`. See
`docs/qa/using-qa.md` for when to run each targeted QA command and how to
interpret the reports.

Run the idle CPU observation separately because it intentionally waits:

```powershell
npm.cmd run qa:desktop:idle
```

Set `DESKAGOTCHI_IDLE_SECONDS=300` for the V2 five-minute idle observation.

Run release QA after packaging changes:

```powershell
npm.cmd run qa:release
```

This rebuilds the Windows installer, checks that packaged resources include the
runtime pet and item assets, launches `release/win-unpacked/Deskagotchi.exe`,
silently installs into `.qa-runs/`, launches the installed executable, and runs
the generated uninstaller.

Generate the V2 closeout report from the latest QA evidence:

```powershell
npm.cmd run qa:v2:audit
```

This writes `docs/qa/v2-closeout-report.md`. Use strict check-only mode on a
release branch so final validation does not rewrite the tracked report while it
checks the clean worktree gate:

```powershell
npm.cmd run qa:v2:audit -- --strict --check-only
```

Strict mode exits non-zero until the manual V2 acceptance JSON is also exported
and passing.

If the manual checklist JSON is downloaded outside the repo, pass it directly:

```powershell
npm.cmd run qa:v2:audit -- --manual C:\path\to\v2-manual-acceptance-export.json
```

Smoke-test the audit's strict-mode behavior without changing the real closeout
report:

```powershell
npm.cmd run qa:v2:audit:smoke
```

Smoke-test the manual acceptance page export logic and refresh its screenshot:

```powershell
npm.cmd run qa:v2:manual-page -- --update-screenshot
```

Routine `npm.cmd run qa:v2:manual-page` runs without changing tracked
screenshots and writes `.qa-runs/<run-id>-manual-page/` evidence for the V2
closeout audit.

Manual checklist checkboxes mean the gate was tested and passed. If a gate is
accepted as out of scope for V2, mark its deferral in the checklist and fill in
the approver plus rationale. The manual page and closeout audit both require
the run context fields before `manualPass` can be true. Strict V2 closeout also
requires a clean Git worktree so QA evidence is not claimed against uncommitted
local changes. Use `--check-only` for the final release gate; run without it
only when intentionally refreshing the Markdown closeout report.

Regenerate LCD item icons:

```powershell
npm.cmd run generate:items
```

Regenerate the V2 visual acceptance page:

```powershell
npm.cmd run generate:visual-qa
```

Use the manual V2 checklist for physical acceptance work:

```text
docs/qa/v2-manual-acceptance.html
```

The checklist can download `v2-manual-acceptance-export.json`. Keep that JSON
with the release evidence or pass it to the V2 audit with `--manual`.

Regenerate the Windows app icon:

```powershell
npm.cmd run generate:icon
```

## Build

```powershell
npm.cmd run build
```

Build a Windows installer:

```powershell
npm.cmd run package:win
```

Unsigned Windows builds may trigger SmartScreen warnings until the binary has signing and reputation.

## Local Data

Runtime state is stored under Electron's `app.getPath("userData")` directory.

The app stores:

- `deskagotchi-save.json`
- `deskagotchi-save.backup.json`
- `custom-pets/`
- `exports/`

The settings panel displays the resolved local data path.

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

User-facing Hatch/custom pet generation is archived for the V2 release path.
The earlier prototype proved local package installation mechanics, but a real
custom pet flow still needs a full generation, approval, QA, packaging,
moderation, and failure-recovery design before it should be exposed in the app.

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
4. Add any pet-specific foods to `scripts/generate-lcd-item-icons.mjs`, then run `npm.cmd run generate:items`.
5. Run `npm.cmd run validate:pets`, `npm.cmd run qa:assets:pets`, and `npm.cmd run qa:assets:items`.
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

- `src/main/`: Electron main process, tray, windows, persistence, package registry, import/export, and archived Hatch draft research code.
- `src/preload/`: Typed IPC bridge.
- `src/renderer/`: Overlay and panel React UI.
- `src/shared/`: Domain schemas, archived Hatch validation, package validation, IPC types, deterministic simulation.
- `resources/pets/`: Built-in pet packages.
- `resources/items/`: Built-in item icon atlases and care item manifests.
- `scripts/`: App icon, item atlas, and QA utility scripts.

The simulation engine is framework-agnostic and uses injected time so offline progression and evolution can be tested deterministically.
