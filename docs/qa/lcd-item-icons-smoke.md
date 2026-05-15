# LCD Item Icon QA

Use this checklist when validating the `lcd-core` item icon set.

## Generated Assets

| Asset | Dimensions | Size |
| --- | ---: | ---: |
| `resources/items/lcd-core/items.png` | `288x336` | `2,495 bytes` |
| `resources/items/lcd-core/items.json` | n/a | `14,530 bytes` |
| `docs/qa/lcd-item-icons-contact-sheet.png` | `316x368` | `3,610 bytes` |
| `docs/qa/lcd-food-icons-contact-sheet.png` | `212x264` | `1,953 bytes` |

## Coverage

- Meal icons: bowl, rice ball, bread plate, dumpling, fish bite, banana,
  leafy bundle, sugarcane, chicken bite, steamed bun, peas, corn kernels.
- Snack icons: biscuit, candy, cake, apple slice, milk, mango cube, melon slice.
- Toy icons: ball, rope, card, chase sparkle.
- Medicine icons: capsule, bottle, bandage, thermometer.
- Clean icons: sponge, broom, sparkle, mess marker.
- Sleep/status icons: crescent, lamp, sleep mark, heart, meter, scale, face.

## Manual Visual Check

- Open `docs/qa/lcd-item-icons-contact-sheet.png`.
- Open `docs/qa/lcd-food-icons-contact-sheet.png`.
- Confirm every icon is readable at 18-24 CSS px.
- Confirm the food contact sheet reads from silhouette first: rice ball,
  dumpling, chicken, fish, banana, leafy bundle, sugarcane, peas, corn, apple,
  milk, mango, melon, candy, and cake should not require the runtime label to
  understand the broad food.
- Confirm icons use only the monochrome LCD palette.
- Confirm the atlas has transparent cells, no scenery, no UI panels, and no
  copied proprietary virtual-pet assets.
- Confirm overlay buttons render atlas icons for Meal, Play, Clean, Sleep,
  Health, and mood.

## Runtime Check

1. Run `pnpm run generate:items`.
2. Run `pnpm run check`.
3. Start Electron with `pnpm run dev`.
4. Open the pet overlay action menu.
5. Confirm the care buttons show LCD-style icons from the atlas and still fit in
   the compact overlay.
