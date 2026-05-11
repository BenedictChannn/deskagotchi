# Deskagotchi V2 Visual Review Notes

Review date: 2026-05-11

Reviewer: Codex visual QA

Scope: built-in pet recognizability, animation-row quality, food icon
recognizability, and monochrome LCD style cohesion using the current committed
visual QA artifacts.

This review is evidence for the visual quality tranche. It does not replace the
remaining physical desktop acceptance gates for installer, startup-on-login,
sleep/wake, unusual monitor layouts, RDP, taskbar, or SmartScreen behavior.

## Evidence Reviewed

| Artifact | Purpose |
| --- | --- |
| `docs/qa/v2-visual-acceptance.html` | Combined acceptance surface for pets, food, items, and review criteria. |
| `docs/qa/v2-visual-acceptance-screenshot.png` | Full-page screenshot of the current acceptance surface. |
| `docs/qa/pet-animation-gallery.html` | Animated gallery for all built-in pet rows. |
| `docs/qa/bao-contact-sheet.png` | Bao spritesheet contact sheet. |
| `docs/qa/miso-contact-sheet.png` | Miso spritesheet contact sheet. |
| `docs/qa/mochi-contact-sheet.png` | Mochi spritesheet contact sheet. |
| `docs/qa/peanut-contact-sheet.png` | Peanut spritesheet contact sheet. |
| `docs/qa/puddles-contact-sheet.png` | Puddles spritesheet contact sheet. |
| `docs/qa/lcd-food-icons-contact-sheet.png` | Food-only item recognizability sheet. |
| `docs/qa/lcd-item-icons-contact-sheet.png` | Full item atlas sheet. |

## Criteria Result

| Criterion | Result | Notes |
| --- | --- | --- |
| Every pet reads as its intended animal at overlay size. | Pass for current assets. | Bao reads as shih tzu, Miso as cat, Mochi as monkey, Peanut as elephant, and Puddles as duck. Peanut's trunk and Puddles's beak remain visible in the reviewed rows. |
| Animation rows have visible expression or motion changes. | Pass for current assets. | Happy, sad, hungry, eating, playing, sleeping, sick, cleaning, walking, and attention rows show visible pose or expression changes. |
| Frame size and anchor shifts are not distracting. | Pass with minor tolerance. | Miso and Mochi are now consistent enough across rows. Bao has larger source-frame detail than the other pets, but the page-scale presentation remains coherent. |
| Food icons are roughly identifiable without labels. | Pass with residual ambiguity. | Bowl, rice ball, fish, banana, sugarcane, melon, candy, and cake read clearly. Bun, dumpling, leafy bundle, peas, corn, apple slice, mango cube, and chicken bite are acceptable in context but benefit from the compact labels already used in the feed picker. |
| Eating cues match the selected item well enough to notice. | Automated pass, visual spot-check acceptable. | Overlay QA verifies selected-food cues; reviewed sheets keep food cues in the same LCD icon style. |
| Overall LCD style is cohesive across pets and food. | Pass. | All reviewed assets use the same monochrome green LCD palette and compact pixel-art-adjacent proportions. |

## Pet Notes

| Pet | Result | Notes |
| --- | --- | --- |
| Bao | Pass | Strong shih tzu silhouette and expressive rows. Slightly more detailed than the other pets, but still compatible with the LCD palette. |
| Miso | Pass | Size consistency is acceptable after the redraw; rows are readable and cat-like. |
| Mochi | Pass | Monkey silhouette and tail are consistent; walking and attention rows read clearly. |
| Peanut | Pass | Elephant identity is clear across reviewed rows; trunk remains visible in current contact sheet. |
| Puddles | Pass | Current duck redraw is cohesive and expressive; eating, playing, walking, and attention rows are materially better than the earlier version. |

## Food Notes

The food set is viable for V2 with icon-first UI plus short compact labels. At
pure icon-only size, several foods are intentionally simplified because the
monochrome 24x24 source grid does not support much detail. The V2 acceptance
claim should therefore be:

```text
Food icons are recognizable enough for the Deskagotchi V2 feed picker when
shown with the existing compact item names.
```

Avoid claiming that every food icon is self-explanatory in isolation.

Most recognizable without labels:

- Kibble bowl
- Rice ball
- Fish bite
- Banana
- Sugarcane
- Melon slice
- Candy
- Cake

Acceptable with context or compact labels:

- Steamed bun
- Dumpling
- Chicken bite
- Leafy bundle
- Peas
- Corn kernels
- Apple slice
- Milk
- Mango cube
- Biscuit

## Remaining Visual Risk

The visual surface is good enough for V2, but future food work should improve
icon differentiation for bun versus dumpling and apple slice versus mango cube.
That improvement is not a blocker while the feed picker keeps compact labels
available beside the icons.
