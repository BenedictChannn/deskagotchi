# Deskbit Dog LCD Sprite QA

Use this checklist when validating the built-in Deskbit Dog package.

## Generated Assets

| Asset | Dimensions | Size |
| --- | ---: | ---: |
| `resources/pets/deskdog/spritesheet.png` | `384x1056` | `8,386 bytes` |
| `resources/pets/deskdog/preview.png` | `192x192` | `690 bytes` |
| `resources/pets/deskdog/icon.png` | `64x64` | `254 bytes` |
| `docs/qa/deskdog-lcd-contact-sheet.png` | `404x1104` | `10,518 bytes` |

## Manifest Contract

- Frame size is `96x96`.
- Atlas has 4 columns and 11 animation rows.
- Each row has 4 frames.
- Row order is `idle`, `happy`, `sad`, `hungry`, `eating`, `playing`,
  `sleeping`, `sick`, `cleaning`, `walking`, and `attention`.
- Every growth stage declares the full dog animation set.
- The package uses `assetHash: deskdog-lcd-v1` so Electron renderer URLs change
  when the production asset version changes.

## Manual Visual Check

- Open `docs/qa/deskdog-lcd-contact-sheet.png`.
- Confirm each row has visible frame-to-frame changes.
- Confirm the dog silhouette remains anchored and readable at small size.
- Confirm the palette stays within the monochrome LCD style guide.
- Confirm transparent runtime assets do not include baked scenery, shadows,
  labels, panels, or full-color pixels.

## Runtime Check

1. Run `npm.cmd run validate:pets`.
2. Run `npm.cmd run check`.
3. Start Electron with `npm.cmd run dev`.
4. Switch to Deskbit Dog if another pet is active.
5. Trigger Feed, Play, Sleep, Clean, and low-health/sick states where possible.
6. Confirm the pet changes animation rows without stretching, cropping, or stale
   cached sprites.
