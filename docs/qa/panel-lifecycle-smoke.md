# Panel Lifecycle Smoke Checklist

Use this checklist for GitHub issue [#10](https://github.com/BenedictChannn/deskagotchi/issues/10).

- Start the app with `npm.cmd run dev`.
- Confirm the full panel does not auto-open.
- Open a management panel from a tray action.
- Switch between Status, Pets, Hatch, and Settings.
- Click the in-panel close button and confirm the dev app exits cleanly.
- Relaunch the app and confirm only the pet overlay opens.
- In packaged-style testing, confirm closing the panel hides it while the pet and tray stay alive.
- Confirm normal overlay care actions never open the full panel.
