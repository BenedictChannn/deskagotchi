# Deskagotchi Monochrome LCD Style Guide

This guide defines the MVP visual direction for Deskagotchi pets, care controls,
item icons, and compact overlay screens. It uses the approved imagegen mockups as
reference material, but production assets must be committed as lightweight
runtime files under `resources/`.

## Reference Mockups

Use the generated mockup set in
`C:\Users\bened\.codex\generated_images\019df8eb-9215-7d32-86bb-cf51f6433c34`
as the MVP visual reference. The approved direction is monochrome LCD toy art:
small silhouettes, strong readable faces, simple item glyphs, and care screens
that resemble a compact virtual pet device rather than a full web app.

Reference files:

- `ig_03612921113977770169fb0f234c988191aec355b8617248e1.png`
- `ig_03612921113977770169fb109e1cf8819187b0913ab4a0fb4a.png`
- `ig_03612921113977770169fb10efda7881919d1391cb02164009.png`
- `ig_03612921113977770169fb114318f481919c5ea7991496eb6c.png`
- `ig_03612921113977770169fb11aa52708191b12ef2367ff22ee0.png`
- `ig_03612921113977770169fb1229cabc8191a1d8797b1e9c1bdb.png`
- `ig_03612921113977770169fb1284b4b08191a8f20dfa4afc07d8.png`
- `ig_03612921113977770169fb134e32288191af000e918e6edf97.png`
- `ig_03612921113977770169fb140af7e48191a37671d4e663e84f.png`
- `ig_03612921113977770169fb1474d2388191a27cd92d1f68d94e.png`
- `ig_03612921113977770169fb14dba80c81918c1a7fabd57515ac.png`
- `ig_03612921113977770169fb1540212881919de7f785728e1ebb.png`
- `ig_054b085e529e34e50169fae20a421481918e6608409853235b.png`

Do not treat these mockups as final source files. They are visual references for
shape language, density, and interaction layout.

## Palette

The MVP palette is limited to four colors including the LCD background tone.
Transparent backgrounds are allowed for sprites and icons.

| Token | Hex | Use |
| --- | --- | --- |
| `lcd-bg` | `#DCECA8` | LCD fill, small internal highlights, preview cards. |
| `lcd-mid` | `#7D9D58` | Secondary pixels, inactive pixels, shallow shadows, dim UI marks. |
| `lcd-ink` | `#123716` | Primary pet pixels, outlines, face pixels, readable UI icons. |
| `paper-bg` | `#F7F8E7` | Rare panel backing or preview-only background. Do not bake into transparent sprites. |

Rules:

- Pet and item assets use `lcd-ink`, `lcd-mid`, and transparent background by
  default.
- `lcd-bg` may be used inside a sprite only when an LCD-filled body shape needs
  contrast.
- Avoid gradients, glow, blur, soft shadows, anti-aliased brush texture, and
  polished 3D lighting.
- No full-color assets in the MVP runtime. Colorful pet themes can come later as
  a separate mode.

## Pixel Rules

- Author sprites on a visible pixel grid. Edges must read as placed pixels, not
  soft vector curves.
- Use 1-2 logical pixel outlines. Important silhouettes should read at 48px.
- Keep faces simple: two eyes plus one mouth or snout detail is usually enough.
- Use sparse checker or alternating pixels for texture. Do not use noisy
  dithering that flickers during animation.
- Keep animation anchors stable. Feet, shadow position, and face placement should
  not jump unless the animation intentionally moves.
- Runtime rendering must use `image-rendering: pixelated`.
- Transparent unused cells are required for sprite and icon atlases.

## Asset Dimensions

These are production targets for new monochrome assets. Larger imagegen source
files are allowed only as temporary references.

| Asset | Logical Size | Runtime Export | Notes |
| --- | ---: | ---: | --- |
| Pet frame | `64x64` | `128x128` or `192x192` PNG | Use one fixed size per package. MVP dog may keep `192x192` until recut. |
| Pet preview | `96x96` | `192x192` PNG | Static selected pose on transparent background. |
| Pet icon | `32x32` | `64x64` PNG | Tray/picker icon. |
| Menu command icon | `16x16` | CSS/icon font or `32x32` PNG | For core overlay buttons. |
| Item icon | `24x24` | `48x48` PNG atlas cell | Food, toy, medicine, clean, sleep, status items. |
| QA contact sheet | Any | PNG in `docs/qa/` or generated artifact | Not loaded by the app. |

Sprite manifests must declare the real `frameWidth`, `frameHeight`, row, frame
count, fps, and fallback animation. Do not make renderer code assume a fixed
four-frame row unless the manifest says so.

## Animation Rows

The first production dog sheet should use this row order:

| Row | Animation | Frame Intent |
| ---: | --- | --- |
| 0 | `idle` | Blink, breathe, or tail twitch. |
| 1 | `happy` | Bounce, wag, or smiling pose change. |
| 2 | `sad` | Drooped ears/body and slower motion. |
| 3 | `hungry` | Calling, low-energy stance, or bowl-facing pose. |
| 4 | `eating` | Chew or food movement. |
| 5 | `playing` | Excited pose, hop, or toy reaction. |
| 6 | `sleeping` | Breathing motion with closed eyes. |
| 7 | `sick` | Wobble or weakened expression. |
| 8 | `cleaning` | Recovery sparkle/wipe pose, still monochrome. |
| 9 | `walking` | Leg cycle or chase step. |
| 10 | `attention` | Calling or alert bounce. |

Each row should have 2-6 meaningful frames. Repeated static frames are not an
acceptable production animation.

## Overlay Layout

The pet overlay is the normal care surface. It should stay small enough to feel
like a desktop companion, not a normal app window.

| Element | Target |
| --- | --- |
| Pet overlay window | `176x220` CSS px default, transparent background. |
| Visible pet sprite | `96x96` to `128x128` CSS px depending on package art. |
| Care menu | Up to `3x2` grid for core care actions. |
| Care button | `48x44` minimum target, icon-first, max one short label. |
| Compact status card | About `150x128`, only key stats visible. |
| Picker panel | About `160x150`, scroll only when item count exceeds MVP set. |

Care UI should use compact symbols and short labels. Avoid explanatory text,
marketing copy, hero layout, nested cards, or full-page panels in the overlay.

## Care Surface Boundaries

Normal care stays inside the pet overlay:

- Feed.
- Play.
- Clean.
- Sleep/lights.
- Health/status.
- Medicine.
- Petting/clicking.

Management belongs in the full panel or tray:

- Switch pet.
- Import/export pet packages.
- Settings.
- Debug/status inspection.
- Future archived Hatch experiments, only when explicitly re-enabled for research.

A care action must not open the management panel unless it is explicitly a
management action from the tray or panel.

## UI Implementation Checklist

Before merging new visual work:

- The UI uses the four-token LCD palette or existing neutral panel palette.
- Pet care works from the overlay without opening the management panel.
- Text fits at the smallest overlay size and does not overlap sprite art.
- Sprite and icon assets are readable at their runtime size.
- Assets are transparent where they need to blend with the desktop.
- Animation frames visibly change and stay aligned.
- The app remains usable with reduced motion enabled.
