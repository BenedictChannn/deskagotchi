# Puddles Sprite Smoke

Use this checklist when regenerating the built-in duck package.

## Files

| File | Expected |
| --- | --- |
| `resources/pets/puddles/pet.json` | Built-in package manifest for Puddles. |
| `resources/pets/puddles/spritesheet.png` | 11 animation rows, 6 frames per row. |
| `resources/pets/puddles/preview.png` | Happy preview sprite. |
| `resources/pets/puddles/icon.png` | Small idle icon sprite. |
| `resources/pets/puddles/source-metadata.json` | Source trace for imagegen concept and row mapping. |
| `docs/qa/puddles-contact-sheet.png` | Contact sheet for visual row review. |
| `docs/qa/puddles-source-poses.png` | Extracted pose strip from the approved concept sheet. |
| `docs/qa/puddles-source-concept.png` | QA-only source concept copy; not packaged with runtime pet assets. |

## Visual Checks

- Puddles keeps a readable duck silhouette at overlay size.
- Every row keeps the same round body, small beak, head tuft, and wing shape.
- Eating, hungry, sleeping, sick, cleaning, walking, and attention rows are visually distinct.
- The favorite foods in `pet.json` point to real catalog items: peas and corn kernels.
- No old `desk*` placeholder pets return to `resources/pets`.
