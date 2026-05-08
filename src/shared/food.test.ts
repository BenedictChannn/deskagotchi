import { createTestPetPackage } from "./fixtures";
import {
  FoodPreferenceKind,
  feedItemsForPet,
  foodPreferenceForPet
} from "./food";
import { ItemCategory, type ItemCatalogEntry } from "./itemIcons";

describe("food helpers", () => {
  const petPackage = createTestPetPackage();
  const items = [
    item("meal-rice-ball", ItemCategory.Meal),
    item("meal-fish-bite", ItemCategory.Meal),
    item("meal-leafy-bundle", ItemCategory.Meal),
    item("snack-biscuit", ItemCategory.Snack),
    item("snack-milk", ItemCategory.Snack),
    item("snack-candy", ItemCategory.Snack)
  ];

  it("filters feed choices to configured pet foods and excludes dislikes", () => {
    const meals = feedItemsForPet(items, petPackage, ItemCategory.Meal);
    const snacks = feedItemsForPet(items, petPackage, ItemCategory.Snack);

    expect(meals.map((entry) => entry.id)).toEqual([
      "meal-fish-bite",
      "meal-rice-ball"
    ]);
    expect(snacks.map((entry) => entry.id)).toEqual([
      "snack-milk",
      "snack-biscuit"
    ]);
  });

  it("classifies configured food preferences", () => {
    expect(foodPreferenceForPet(petPackage, "meal-fish-bite")).toBe(
      FoodPreferenceKind.Favorite
    );
    expect(foodPreferenceForPet(petPackage, "meal-chicken-bite")).toBe(
      FoodPreferenceKind.Liked
    );
    expect(foodPreferenceForPet(petPackage, "meal-rice-ball")).toBe(
      FoodPreferenceKind.Shared
    );
    expect(foodPreferenceForPet(petPackage, "meal-leafy-bundle")).toBe(
      FoodPreferenceKind.Disliked
    );
  });
});

function item(
  id: string,
  category: ItemCategory.Meal | ItemCategory.Snack
): ItemCatalogEntry {
  return {
    id,
    label: id,
    category,
    iconId: "bowl",
    quantity: "unlimited",
    availability: "always",
    tags: [],
    effects: {}
  };
}
