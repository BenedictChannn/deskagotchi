# Medicine Clean Sleep QA

Use this checklist when validating the remaining overlay care flows.

## Medicine

- Medicine opens inside the pet overlay.
- Sick or low-health pets show a Use action.
- Healthy pets show an OK/no-op state with no medicine action.
- Using medicine improves health, clears sickness, and returns to normal overlay.

## Clean

- Mess markers are visible near the pet when `messCount` is greater than zero.
- Clean opens inside the pet overlay.
- Messy or low-cleanliness pets show a Clean action.
- Already-clean pets show a no-op state.
- Cleaning clears messes and restores cleanliness.

## Sleep

- Sleep opens inside the pet overlay as a lights/rest flow.
- Active pets can be put to sleep.
- Sleeping pets show a Wake action.
- Sleep changes the pet mood/animation to sleeping and wake returns it to active
  care.

## Runtime Check

1. Run `pnpm run check`.
2. Start Electron with `pnpm run dev`.
3. Click the pet and open Med, Clean, and Sleep flows from the overlay.
4. Confirm no flow opens the full management panel.
5. Confirm X and Escape close transient care UI.
