# Deskagotchi Asset Pipeline

This document defines how Deskagotchi turns generated mockups into production
sprites, item icons, and manifests without adding runtime weight or a network
dependency to normal pet care.

## Source Of Truth

Production assets live in the repo. Imagegen outputs are reference material until
they are cleaned, cut, validated, and committed.

| Asset Type | Location |
| --- | --- |
| Built-in pet packages | `resources/pets/<package-id>/` |
| Built-in pet manifest | `resources/pets/<package-id>/pet.json` |
| Built-in pet sprite atlas | `resources/pets/<package-id>/spritesheet.png` |
| Built-in pet preview | `resources/pets/<package-id>/preview.png` |
| Built-in pet icon | `resources/pets/<package-id>/icon.png` |
| Item icon atlas | `resources/items/<item-set-id>/items.png` |
| Item icon manifest | `resources/items/<item-set-id>/items.json` |
| Design reference docs | `docs/design/` |
| Manual QA notes/previews | `docs/qa/` |
| Temporary imagegen source | Outside repo unless intentionally archived under `docs/qa/` |

Do not load mockup images from `C:\Users\bened\.codex\generated_images` at
runtime. The app must run from committed resources and local user data only.

## Workflow

1. Generate broad visual mockups with `$imagegen`.
2. Select an approved direction and record the selected file names in a design
   doc.
3. Create or clean a canonical production pet pose in the monochrome LCD style.
4. Cut true animation frames from the canonical pose. Do not use identical
   repeated frames as production animation.
5. Assemble sprite rows into a transparent PNG atlas.
6. Export preview and icon PNGs from the same canonical asset.
7. Update `pet.json` with exact file paths, row order, frame counts, fps values,
   fallbacks, growth stage animation sets, palette, and generation metadata.
8. Run package validation and app checks.
9. Create a QA contact sheet or short capture showing every row at runtime size.
10. Commit only the production assets, manifest changes, docs, and QA artifacts
    needed for the finished slice.

## Runtime Weight Targets

Deskagotchi should feel lightweight on a laptop. These are MVP budgets, not hard
security limits.

| Asset | Target |
| --- | ---: |
| One pet sprite atlas | Under `300 KB`; prefer under `150 KB` after recut. |
| Pet icon | Under `20 KB`. |
| Pet preview | Under `50 KB`. |
| Item icon atlas | Under `100 KB`. |
| Built-in starter roster assets | Under `2 MB` total for MVP. |
| Active overlay animation | One visible sprite animation timer only. |

Use PNG first for the monochrome mode because it is simple, transparent,
lossless, and easy to inspect. WebP can be introduced later only if measured app
size or installer size makes it worth the added authoring friction.

## Sprite Atlas Contract

A pet package sprite atlas is a row-based transparent PNG.

Manifest requirements:

- `assets.spritesheet` points to the committed atlas path inside the package.
- `animations[*].id` is one of the supported `AnimationId` values.
- `animations[*].row` is the zero-based row in the atlas.
- `animations[*].frames` is the real number of frames in that row.
- `animations[*].frameWidth` and `frameHeight` match the atlas cell size.
- `animations[*].fps` reflects the intended feel, not a renderer default.
- `animations[*].fallback` points to an animation that exists in the package.
- `growthStages[*].animationSet` lists only animations available for that stage.

Renderer code should consume the manifest instead of hardcoding row count, frame
count, or growth-stage availability.

## Item Icon Contract

Item icons should be atlas-backed rather than many scattered one-off files. The
first committed item set is `resources/items/lcd-core/`.

Planned `items.json` fields:

- `schemaVersion`
- `itemSetId`
- `palette`
- `atlas`
- `cellWidth`
- `cellHeight`
- `icons`
- `items`

Each icon entry should include:

- `id`
- `label`
- `category`
- `row`
- `column`
- `alt`

Each item entry should include:

- `id`
- `label`
- `category`: `meal`, `snack`, `toy`, `medicine`, `clean`, `sleep`, or
  `status`
- `iconId`
- `effects`
- `availability`

The feed/play/care UI should read from this data instead of hardcoding every
option inside React components.

The current renderer consumes this through `src/renderer/src/itemIconAssets.ts`
and `src/renderer/src/components/ItemIcon.tsx`.

## Lightweight Validation

The current package validator already enforces:

- Referenced package asset files exist.
- File extension is allowed: `.png`, `.webp`, or `.svg` for legacy placeholders.
- Package asset paths cannot escape the package root.
- Package files cannot include executable/script payloads.
- Package assets stay under the current file-size safety limit.
- Required MVP animation ids exist: `idle`, `happy`, `walking`, `sleeping`, and `sick`.
- Animation fallbacks reference declared animations.
- Each growth-stage animation set references only declared animations.
- Growth-stage care-score ranges are not inverted.

Production asset QA should still add visual and atlas checks:

- Atlas dimensions divide cleanly by frame or cell size.
- Animation rows fit inside the atlas height.
- Frame counts fit inside the atlas width.
- Transparent corners remain transparent for pet sprites and icons.
- Contact sheets match the current committed assets and are nonblank.

## Built-In Versus Hatch Assets

Built-in packages are curated and committed under `resources/`. They should pass
validation before release and should not require network access.

Custom Hatch packages are user data. They should follow the same manifest shape,
but they are created under the app data directory and must be treated as
untrusted imports. Hatch generation may call image generation tools during
creation, but installed custom pets must run offline afterward.

## Offline Runtime Rule

Normal care gameplay must never depend on imagegen, cloud access, or mockup
source files. Feed, play, clean, medicine, sleep, health, switching pets, and
state simulation must work with local package assets and local save data only.
