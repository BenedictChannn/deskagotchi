# Feed Picker QA

Use this checklist when validating the overlay Feed flow.

## Coverage

- Feed opens inside the pet overlay.
- Meal and Snack tabs are available.
- Meal tab exposes at least Kibble Bowl, Rice Ball, Toast Plate, and Dumpling.
- Snack tab exposes Biscuit, Candy, and Cake.
- Each feed item has an atlas icon, label, unlimited quantity metadata, and stat
  effects in `resources/items/lcd-core/items.json`.
- Selecting a meal sends `feed_meal` with the selected item id.
- Selecting a snack sends `feed_snack` with the selected item id.
- Feeding applies item-specific effects and shows the eating mood/animation.

## Runtime Check

1. Run `pnpm run generate:items`.
2. Run `pnpm run check`.
3. Start Electron with `pnpm run dev`.
4. Click the pet, choose Feed, switch between Meal and Snack tabs.
5. Select two different foods and confirm stats change differently.
6. Confirm the picker closes after selection and the full management panel does
   not open.
