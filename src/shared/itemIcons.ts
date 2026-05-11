/**
 * Shared item icon atlas and item catalog schemas.
 *
 * @module
 */
import { z } from "zod";

/** Item and icon groups shown in compact care UI. */
export enum ItemCategory {
  Meal = "meal",
  Snack = "snack",
  Toy = "toy",
  Medicine = "medicine",
  Clean = "clean",
  Sleep = "sleep",
  Status = "status"
}

/** Lightweight food taxonomy used for filtering and pet preferences. */
export enum ItemTag {
  Shared = "shared",
  Grain = "grain",
  Fruit = "fruit",
  Bakery = "bakery",
  Meat = "meat",
  Fish = "fish",
  Dairy = "dairy",
  Leafy = "leafy",
  Plant = "plant",
  Dog = "dog",
  Cat = "cat",
  Duck = "duck",
  Primate = "primate",
  Herbivore = "herbivore",
  Treat = "treat"
}

/** Stat deltas an item can apply when a later care flow consumes it. */
export const ItemEffectsSchema = z
  .object({
    hunger: z.number().min(-100).max(100).optional(),
    happiness: z.number().min(-100).max(100).optional(),
    energy: z.number().min(-100).max(100).optional(),
    cleanliness: z.number().min(-100).max(100).optional(),
    health: z.number().min(-100).max(100).optional(),
    affection: z.number().min(-100).max(100).optional(),
    discipline: z.number().min(-100).max(100).optional(),
    weight: z.number().min(-100).max(100).optional()
  })
  .strict();

/** One icon cell inside an item atlas. */
export const ItemIconEntrySchema = z
  .object({
    id: z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9-]+$/),
    label: z.string().min(1).max(40),
    category: z.nativeEnum(ItemCategory),
    row: z.number().int().min(0),
    column: z.number().int().min(0),
    alt: z.string().min(1).max(120)
  })
  .strict();

/** One selectable care item that references an atlas icon. */
export const ItemCatalogEntrySchema = z
  .object({
    id: z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9-]+$/),
    label: z.string().min(1).max(40),
    category: z.nativeEnum(ItemCategory),
    iconId: ItemIconEntrySchema.shape.id,
    quantity: z.literal("unlimited"),
    availability: z.enum(["always", "when_sick", "when_messy", "when_tired"]),
    tags: z.array(z.nativeEnum(ItemTag)).default([]),
    effects: ItemEffectsSchema
  })
  .strict();

/** Manifest for a lightweight item icon atlas and optional item catalog. */
export const ItemIconManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    itemSetId: z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9-]+$/),
    name: z.string().min(1).max(80),
    description: z.string().min(1).max(240),
    assetVersion: z.string().min(1).max(40),
    atlas: z.string().min(1).max(180).regex(/^[a-zA-Z0-9._/-]+$/),
    cellWidth: z.number().int().min(8).max(256),
    cellHeight: z.number().int().min(8).max(256),
    columns: z.number().int().min(1).max(32),
    palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1).max(4),
    icons: z.array(ItemIconEntrySchema).min(1),
    items: z.array(ItemCatalogEntrySchema).default([])
  })
  .strict();

/** Parsed icon cell metadata. */
export type ItemIconEntry = z.infer<typeof ItemIconEntrySchema>;

/** Parsed care item metadata. */
export type ItemCatalogEntry = z.infer<typeof ItemCatalogEntrySchema>;

/** Parsed item icon atlas manifest. */
export type ItemIconManifest = z.infer<typeof ItemIconManifestSchema>;

/**
 * Find one icon entry by id.
 *
 * @param manifest - Parsed atlas manifest.
 * @param iconId - Icon identifier.
 * @returns The icon entry, or undefined when missing.
 */
export function findItemIcon(
  manifest: ItemIconManifest,
  iconId: string
): ItemIconEntry | undefined {
  return manifest.icons.find((icon) => icon.id === iconId);
}
