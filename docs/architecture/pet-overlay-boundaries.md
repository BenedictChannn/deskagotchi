# Pet Overlay Boundaries

Deskagotchi's MVP movement model treats the transparent Electron overlay as the pet's desktop body. Dragging the visible pet sprite moves that overlay window.

## MVP Rules

- The pet starts on the primary display work area.
- The pet can be dragged by the visible sprite.
- A click opens the care menu; a drag suppresses that click.
- Movement is clamped to the selected display work area so the pet cannot be fully lost offscreen.
- The saved overlay bounds are restored on startup after visibility clamping.
- Multi-monitor roaming is supported for adjacent and negative-coordinate displays by using the pointer position, window center, then largest intersection to select the target display.

## Implementation Notes

- Renderer pointer movement is reported through `deskagotchi.movePetWindow`.
- The main process validates drag deltas and optional screen-space pointer coordinates before moving the native window.
- `ensureVisibleBounds` clamps restored and dragged bounds against Electron display work areas.
- `finishPetWindowDrag` persists the final bounds after dragging ends.
