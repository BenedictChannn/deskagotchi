/**
 * Shared food catalog helpers for pet-specific feed choices and effects.
 *
 * @module
 */
import type { PetPackage, PetStats } from "./domain";
import type { ItemCategory, ItemCatalogEntry } from "./itemIcons";

/** Relationship between a pet and a food item. */
export enum FoodPreferenceKind {
  Favorite = "favorite",
  Liked = "liked",
  Shared = "shared",
  Disliked = "disliked",
  Neutral = "neutral"
}

/**
 * Filters feedable items to the active pet's configured diet.
 *
 * @param items - Full item catalog from the active item manifest.
 * @param petPackage - Active pet package containing diet preferences.
 * @param category - Meal or snack tab currently shown.
 * @returns Ordered feed choices for the pet and category.
 */
export function feedItemsForPet(
  items: ItemCatalogEntry[],
  petPackage: PetPackage,
  category: ItemCategory.Meal | ItemCategory.Snack
): ItemCatalogEntry[] {
  const configuredIds = orderedConfiguredFoodIds(petPackage);
  const dislikedIds = new Set(petPackage.foodPreferences.dislikedFoodIds);

  if (configuredIds.length === 0) {
    return items.filter((item) => item.category === category);
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));
  return configuredIds
    .map((itemId) => itemsById.get(itemId))
    .filter(isCatalogEntry)
    .filter((item) => item.category === category && !dislikedIds.has(item.id));
}

/**
 * Classifies a food item against a pet's diet metadata.
 *
 * @param petPackage - Pet package containing food preference ids.
 * @param itemId - Item identifier from the food catalog.
 * @returns Preference bucket for UI labels and simulation modifiers.
 */
export function foodPreferenceForPet(
  petPackage: PetPackage,
  itemId: ItemCatalogEntry["id"]
): FoodPreferenceKind {
  const preferences = petPackage.foodPreferences;
  if (preferences.dislikedFoodIds.includes(itemId)) {
    return FoodPreferenceKind.Disliked;
  }
  if (preferences.favoriteFoodIds.includes(itemId)) {
    return FoodPreferenceKind.Favorite;
  }
  if (preferences.likedFoodIds.includes(itemId)) {
    return FoodPreferenceKind.Liked;
  }
  if (preferences.sharedFoodIds.includes(itemId)) {
    return FoodPreferenceKind.Shared;
  }
  return FoodPreferenceKind.Neutral;
}

/**
 * Applies small pet-preference modifiers after a base food effect.
 *
 * @param stats - Stats after the base item effect has been applied.
 * @param petPackage - Active pet package with food preferences.
 * @param itemId - Consumed item id.
 * @returns Stats adjusted for liked, favorite, or disliked foods.
 */
export function applyFoodPreferenceModifiers(
  stats: PetStats,
  petPackage: PetPackage,
  itemId: ItemCatalogEntry["id"]
): PetStats {
  const preference = foodPreferenceForPet(petPackage, itemId);
  switch (preference) {
    case FoodPreferenceKind.Favorite:
      return applyStatDelta(stats, { happiness: 4, affection: 3, health: 1 });
    case FoodPreferenceKind.Liked:
      return applyStatDelta(stats, { happiness: 2, affection: 1 });
    case FoodPreferenceKind.Disliked:
      return applyStatDelta(stats, { happiness: -7, affection: -2, health: -1 });
    case FoodPreferenceKind.Shared:
    case FoodPreferenceKind.Neutral:
      return stats;
  }
}

function orderedConfiguredFoodIds(petPackage: PetPackage): string[] {
  const preferences = petPackage.foodPreferences;
  const orderedIds = [
    ...preferences.favoriteFoodIds,
    ...preferences.likedFoodIds,
    ...preferences.sharedFoodIds
  ];
  return Array.from(new Set(orderedIds));
}

function isCatalogEntry(
  item: ItemCatalogEntry | undefined
): item is ItemCatalogEntry {
  return item !== undefined;
}

function applyStatDelta(
  stats: PetStats,
  delta: Partial<Pick<PetStats, "happiness" | "affection" | "health">>
): PetStats {
  return {
    ...stats,
    happiness: clampStat(stats.happiness + (delta.happiness ?? 0)),
    affection: clampStat(stats.affection + (delta.affection ?? 0)),
    health: clampStat(stats.health + (delta.health ?? 0))
  };
}

function clampStat(value: number): number {
  return Math.min(100, Math.max(0, Number(value.toFixed(3))));
}
