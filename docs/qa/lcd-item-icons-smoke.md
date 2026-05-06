# LCD Item Icon QA

Use this checklist when validating the `lcd-core` item icon set.

## Generated Assets

| Asset | Dimensions | Size |
| --- | ---: | ---: |
| `resources/items/lcd-core/items.png` | `288x240` | `1,508 bytes` |
| `resources/items/lcd-core/items.json` | n/a | `7,891 bytes` |
| `docs/qa/lcd-item-icons-contact-sheet.png` | `316x264` | `2,315 bytes` |

## Coverage

- Meal icons: bowl, rice ball, bread plate, dumpling.
- Snack icons: biscuit, candy, cake.
- Toy icons: ball, rope, card, chase sparkle.
- Medicine icons: capsule, bottle, bandage, thermometer.
- Clean icons: sponge, broom, sparkle, mess marker.
- Sleep/status icons: crescent, lamp, sleep mark, heart, meter, scale, face.

## Manual Visual Check

- Open `docs/qa/lcd-item-icons-contact-sheet.png`.
- Confirm every icon is readable at 18-24 CSS px.
- Confirm icons use only the monochrome LCD palette.
- Confirm the atlas has transparent cells, no scenery, no UI panels, and no
  copied proprietary virtual-pet assets.
- Confirm overlay buttons render atlas icons for Meal, Play, Clean, Sleep,
  Health, and mood.

## Runtime Check

1. Run `npm.cmd run generate:items`.
2. Run `npm.cmd run check`.
3. Start Electron with `npm.cmd run dev`.
4. Open the pet overlay action menu.
5. Confirm the care buttons show LCD-style icons from the atlas and still fit in
   the compact overlay.
