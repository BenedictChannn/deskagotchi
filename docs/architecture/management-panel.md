# Management Panel

The full Deskagotchi panel is a management surface, not part of the normal care loop.

## Allowed Uses

- Settings.
- Switch pet.
- Import or export pet packs.
- Development or debug status views.
- Future archived Hatch experiments, only when explicitly re-enabled for research.

## Not Allowed

- Normal Feed, Play, Clean, Sleep, Health, or Medicine actions.
- Any care action that should feel like a handheld virtual-pet interaction.
- Any overlay shortcut that traps the user in a full desktop window.

## Lifecycle Rules

- In development, closing the panel quits the local Electron run so test windows do not linger.
- In packaged-style operation, closing or hiding the panel should leave the tray companion alive.
- The panel includes an explicit close button in addition to native window controls.
- The tray owns long-lived management entry points.
