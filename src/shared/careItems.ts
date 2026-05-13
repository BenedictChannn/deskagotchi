import { CareActionType } from "./domain";
import type { CareActionRequest } from "./ipc";
import {
  ItemCategory,
  type ItemCatalogEntry,
  type ItemIconManifest
} from "./itemIcons";

/**
 * Resolve and validate an optional care item for a renderer care request.
 *
 * @param request - Care action request from runtime, IPC, or dev bridge code.
 * @param itemManifest - Parsed care item catalog.
 * @returns The selected item, or undefined for legacy item-less actions.
 * @throws Error when the selected item is unknown or has the wrong category.
 */
export function resolveCareItem(
  request: CareActionRequest,
  itemManifest: ItemIconManifest
): ItemCatalogEntry | undefined {
  if (request.itemId === undefined) {
    return undefined;
  }

  const item = itemManifest.items.find((candidate) => candidate.id === request.itemId);
  if (item === undefined) {
    throw new Error(`Unknown care item '${request.itemId}'.`);
  }

  if (request.type === CareActionType.FeedMeal && item.category !== ItemCategory.Meal) {
    throw new Error(`Care item '${item.id}' is not a meal.`);
  }
  if (request.type === CareActionType.FeedSnack && item.category !== ItemCategory.Snack) {
    throw new Error(`Care item '${item.id}' is not a snack.`);
  }

  return item;
}
