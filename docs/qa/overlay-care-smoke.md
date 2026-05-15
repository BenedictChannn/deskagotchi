# Overlay Care Smoke Checklist

Use this checklist for GitHub issue [#2](https://github.com/BenedictChannn/deskagotchi/issues/2).

## Panel Route Audit

- `src/renderer/src/components/OverlayApp.tsx` must not import `PanelView`.
- `src/renderer/src/components/OverlayApp.tsx` must not call `window.deskagotchi.openPanel`.
- Full panel entry points are allowed from tray or management UI only, not from the normal pet overlay care menu.

## Manual Smoke

- Start the app with `pnpm run dev`.
- Confirm only the pet overlay opens by default.
- Click the pet and confirm the care menu contains only `Meal`, `Play`, `Clean`, `Sleep`, and `Health`.
- Click `Health` and confirm a compact in-overlay status card appears.
- Confirm `Health` does not open a full Electron panel window.
- Press `Escape` and confirm the menu or health card closes.
- Click `Meal`, `Play`, `Clean`, and `Sleep`; each should act in-place and close transient overlay UI.
- Confirm there is no `More` button in the normal care menu.
