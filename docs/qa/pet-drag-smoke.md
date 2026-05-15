# Pet Drag Smoke Checklist

Use this checklist for GitHub issue [#3](https://github.com/BenedictChannn/deskagotchi/issues/3).

- Start the app with `pnpm run dev`.
- Confirm only the pet overlay opens by default.
- Click the visible pet without dragging and confirm the care menu opens.
- Drag the visible pet and confirm the overlay moves through the pet sprite
  pointer handler, not a native full-window drag region.
- Confirm dragging does not open the care menu.
- Drag the pet toward each screen edge and confirm it remains visible.
- Restart the app and confirm the pet restores to the last valid visible position.
- Use the tray reset action and confirm the pet returns to the default lower-right position.
