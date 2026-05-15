# App Icon

Deskagotchi uses a generated raster icon as the source for Windows and macOS
packaging.

## Files

| File | Purpose |
| --- | --- |
| `build/icon-source.png` | Transparent imagegen source kept as the canonical app icon artwork. |
| `build/icon.png` | 1024px PNG generated from the source. |
| `build/icon.ico` | Windows icon consumed by Electron Builder. |
| `build/icon.icns` | macOS icon consumed by Electron Builder. |

Regenerate the platform icon files after changing `build/icon-source.png`:

```powershell
pnpm run generate:icon
```

The generator uses Python and Pillow to resize the source PNG and write ICO and
ICNS outputs. The committed outputs are used by packaging; regeneration is only
needed when the source artwork changes.

## Imagegen Source Prompt

The current icon was generated with the built-in `$imagegen` skill and then
converted from a chroma-key background to alpha.

```text
Use case: logo-brand
Asset type: Electron desktop app icon source, later cropped to square and converted to Windows ICO and macOS ICNS
Primary request: Create a distinctive Deskagotchi app icon: a cute original virtual desktop pet mascot sitting inside a small rounded retro LCD desktop-screen badge.
Subject: original tiny pixel-pet companion, not Tamagotchi, not any existing character; friendly face, compact ears, small paws, simple silhouette that remains readable at 32px.
Style/medium: polished raster app icon, vector-friendly shapes, crisp edges, subtle depth, retro LCD game influence, modern desktop app polish.
Composition/framing: centered square icon, generous padding, full subject visible, strong silhouette, no text.
Color palette: deep green LCD ink, pale mint screen, warm coral/orange accent, dark outline; avoid purple-blue gradient dominance.
Constraints: background must be a perfectly flat solid #00ff00 chroma-key for local alpha removal; no shadows touching the background; do not use #00ff00 anywhere in the subject; no text, no letters, no watermark, no logos, no proprietary toy shapes.
```

## Acceptance Notes

- The icon must remain readable at 32px.
- Corners must be transparent in `icon-source.png`, `icon.png`, `icon.ico`, and
  `icon.icns`.
- The icon should not copy Tamagotchi shell designs, proprietary mascots, or any
  existing product logo.
