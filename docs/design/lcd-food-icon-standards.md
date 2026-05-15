# LCD Food Icon Standards

This document defines the visual bar for Deskagotchi food items. The icons do
not need to be high-resolution illustrations, but users should be able to
roughly identify the food without reading the label.

The code source of truth for generated item assets is
`scripts/generate-lcd-item-icons.mjs`. The runtime asset output lives in
`resources/items/lcd-core/items.png` and `resources/items/lcd-core/items.json`.
QA contact sheets live under `docs/qa/`.

## Goal

Food icons should feel like tiny monochrome virtual-pet LCD objects:

- Small.
- Simple.
- Pixel-readable.
- Cohesive with pet sprites.
- Recognizable at overlay size.
- Not detailed, glossy, or realistic.

## Current Problem

Several current food icons are too abstract. The user may know the item only
because the text label says it. That is not good enough for V2.

The V2 bar is:

- At `48x48` atlas size, the item should be identifiable from shape alone.
- At overlay display size, the broad category should still be clear.
- If two foods look similar, each needs a stronger silhouette cue.

## Palette

Use the same LCD palette as the rest of the runtime:

| Token | Hex | Use |
| --- | --- | --- |
| `lcd-bg` | `#DCECA8` | Optional LCD fill or preview backing. |
| `lcd-mid` | `#7D9D58` | Secondary pixels and internal details. |
| `lcd-ink` | `#123716` | Primary outline and key shape. |
| `paper-bg` | `#F7F8E7` | Contact sheet or rare UI backing. |

Food cells should stay transparent unless the atlas/contact sheet provides a
preview background.

## Shape Rules

- Use one dominant silhouette per food.
- Avoid relying on tiny internal dots as the only identity cue.
- Prefer side-view or iconic shapes over top-down ambiguity.
- Keep at least 2 logical pixels of padding around the item.
- Use `lcd-ink` for the outer shape and `lcd-mid` for only one or two internal
  details.
- Do not add text, letters, labels, faces, or speech bubbles.
- Avoid making all food circular.

## Food-Specific Direction

| Item | Required cue |
| --- | --- |
| Kibble bowl | Bowl shape plus visible kibble bumps. |
| Rice ball | Triangle or rounded triangle with one seaweed patch. |
| Steamed bun | Rounded bun with pleat marks. |
| Dumpling | Crescent fold with crimp marks. |
| Chicken bite | Drumstick or bite-shaped meat cue, not a random blob. |
| Fish bite | Fish silhouette or fish steak shape with tail/bone cue. |
| Banana | Curved banana silhouette. |
| Leafy bundle | Cluster of leaves with stems, not a generic pile. |
| Sugarcane | Segmented cane sticks. |
| Peas | Pod or small grouped peas with pod outline. |
| Corn kernels | Cob segment or kernel cluster with corn shape. |
| Biscuit | Square biscuit with corner/center holes. |
| Apple slice | Crescent wedge with peel edge. |
| Milk | Small bottle/carton silhouette. |
| Mango cube | Chunk or cube with fruit mark; distinguish from candy. |
| Melon slice | Wedge with rind line. |
| Candy | Wrapped candy silhouette. |
| Cake | Slice shape with layer line. |

## QA Checklist

Before accepting food icon changes:

- Regenerate the atlas with `pnpm run generate:items`.
- Open `docs/qa/lcd-food-icons-contact-sheet.png`.
- Check every food without reading item labels.
- Check the feed picker in the actual overlay.
- Check the eating food cue for at least Bao, Miso, Mochi, Peanut, and Puddles.
- Verify the atlas and manifest still pass `pnpm run qa:assets:items`.

Acceptance language should be concrete:

- Good: "corn reads as a cob/kernels at overlay size."
- Bad: "icons look nicer."

## Implementation Notes

The current generator is procedural. If procedural shapes are too limiting, the
next acceptable step is still lightweight:

- Keep one atlas PNG.
- Keep the JSON manifest.
- Use generated or manually drawn bitmap cells as source assets.
- Avoid individual large food files.
- Preserve transparent cells and pixelated rendering.
