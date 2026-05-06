# Deskagotchi

Deskagotchi is a Windows-first desktop virtual pet companion built with Electron, React, TypeScript, Vite, and a manifest-driven pet package system.

The app runs as a small transparent frameless pet window with tray controls, local persistence, deterministic real-time care simulation, built-in original pets, and a Hatch MVP for local custom pets.

## Current Capabilities

- Transparent frameless pet overlay window.
- Tray menu with show, hide, reset position, feed, play, clean, sleep, health, pet selector, Hatch, settings, and quit.
- Single-instance app behavior.
- Multi-monitor-safe position recovery.
- Crash-safe local save file with backup recovery.
- Deterministic simulation with offline progression caps.
- Stats for hunger, happiness, energy, cleanliness, health, affection, discipline, age, weight, mood, care history, illness, and messes.
- Built-in original placeholder roster:
  - Deskcat
  - Deskdog
  - Deskduck
  - Deskblob
- Deskcat includes multiple care-based growth variants.
- Shared package schema for built-in and custom pets.
- Package validation for manifest structure, safe paths, missing assets, unsupported files, and executable payloads.
- Local Hatch draft creator with prompt/IP guardrails.
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
http://localhost:5187/#/panel/hatch
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

Regenerate built-in pet assets:

```powershell
npm.cmd run generate:pets
```

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
- `hatch-drafts/`
- `exports/`
- `tmp/`

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
- `assets`
- `animations`
- `growthStages`
- `preferredFoods`
- `dislikedFoods`
- `favoritePlayStyle`
- `careModifiers`
- `colorPalette`
- `capabilities`
- `validationStatus`
- `assetHash`
- `generation`

Imported packages are treated as untrusted. Archives are rejected if they contain unsafe paths, oversized entries, executable/script files, invalid manifests, missing assets, or wrong package source metadata.

## Hatch MVP

Open Hatch from the tray or Pets panel. The current Hatch flow accepts:

- Name
- Description
- Species/concept
- Personality
- Preferred colors
- Optional accessory
- Optional theme

The MVP creates a local placeholder pet package and installs it after validation. It blocks obvious protected/IP-confusing or unsafe terms before creating the package.

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

1. Add or update pet definitions in `scripts/generate-placeholder-pets.mjs`.
2. Run `npm.cmd run generate:pets`.
3. Run `npm.cmd run validate:pets`.
4. Replace placeholder assets with validated imagegen assets when ready.
5. Keep `pet.json` schema-compatible with `src/shared/domain.ts`.

For a fully featured built-in pet, include:

- Egg, baby, child, teen, and adult growth stages.
- At least idle, happy, sleeping, and sick animations.
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

- `src/main/`: Electron main process, tray, windows, persistence, package registry, import/export, Hatch draft creation.
- `src/preload/`: Typed IPC bridge.
- `src/renderer/`: Overlay and panel React UI.
- `src/shared/`: Domain schemas, package validation, IPC types, deterministic simulation.
- `resources/pets/`: Built-in pet packages.
- `scripts/`: Reproducible placeholder asset generation.

The simulation engine is framework-agnostic and uses injected time so offline progression and evolution can be tested deterministically.
