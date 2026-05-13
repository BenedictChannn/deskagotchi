# Pet Overlay Boundaries

Deskagotchi's MVP movement model treats the transparent Electron overlay as the pet's desktop body. Dragging the visible pet sprite moves that overlay window.

## MVP Rules

- The pet starts on the primary display work area.
- The pet can be dragged by the visible sprite.
- A click opens the care menu; a drag suppresses that click.
- Movement is clamped to the selected display work area so the pet cannot be fully lost offscreen.
- The saved overlay bounds are restored on startup after visibility clamping.
- Multi-monitor roaming is supported for right-side, stacked, adjacent, and negative-coordinate displays by using the pointer position, window center, then largest intersection to select the target display.

## Implementation Notes

- Renderer pointer movement is reported through `deskagotchi.movePetWindow`.
- The main process validates drag deltas and optional screen-space pointer coordinates before moving the native window.
- `ensureVisibleBounds` clamps restored and dragged bounds against Electron display work areas.
- `finishPetWindowDrag` persists the final bounds after dragging ends.

## Verification Boundaries

- `src/main/windowBounds.test.ts` covers pure display-selection and clamping
  behavior for right-side, negative-coordinate, stacked-above, stacked-below,
  largest-intersection, and no-intersection fallback layouts.
- `corepack pnpm run qa:desktop:drag` exercises a real OS drag and records
  `display-topology.json`; on the current test machine it also covers a
  left-side negative-coordinate monitor.
- Right-side and stacked physical display arrangements still need manual or
  hardware-specific QA before a full V2 desktop-hardware claim.
