import { CareActionType } from "./domain";
import { resolveCareItem } from "./careItems";
import { ItemCategory, type ItemIconManifest } from "./itemIcons";

const manifest: ItemIconManifest = {
  schemaVersion: 1,
  itemSetId: "test-items",
  name: "Test items",
  description: "Test care item catalog",
  assetVersion: "test",
  atlas: "items.png",
  cellWidth: 16,
  cellHeight: 16,
  columns: 2,
  palette: ["#000000"],
  icons: [
    {
      id: "rice-icon",
      label: "Rice",
      category: ItemCategory.Meal,
      row: 0,
      column: 0,
      alt: "Rice"
    },
    {
      id: "cookie-icon",
      label: "Cookie",
      category: ItemCategory.Snack,
      row: 0,
      column: 1,
      alt: "Cookie"
    }
  ],
  items: [
    {
      id: "rice",
      label: "Rice",
      category: ItemCategory.Meal,
      iconId: "rice-icon",
      quantity: "unlimited",
      availability: "always",
      tags: [],
      effects: {}
    },
    {
      id: "cookie",
      label: "Cookie",
      category: ItemCategory.Snack,
      iconId: "cookie-icon",
      quantity: "unlimited",
      availability: "always",
      tags: [],
      effects: {}
    }
  ]
};

describe("resolveCareItem", () => {
  it("returns undefined for legacy item-less actions", () => {
    expect(resolveCareItem({ type: CareActionType.Play }, manifest)).toBeUndefined();
  });

  it("rejects unknown item ids", () => {
    expect(() =>
      resolveCareItem({ type: CareActionType.FeedMeal, itemId: "missing" }, manifest)
    ).toThrow("Unknown care item");
  });

  it("rejects meal and snack category mismatches", () => {
    expect(() =>
      resolveCareItem({ type: CareActionType.FeedMeal, itemId: "cookie" }, manifest)
    ).toThrow("not a meal");
    expect(() =>
      resolveCareItem({ type: CareActionType.FeedSnack, itemId: "rice" }, manifest)
    ).toThrow("not a snack");
  });
});
