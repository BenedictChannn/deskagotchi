import { findItemIcon, ItemIconManifestSchema } from "@shared/itemIcons";
import type { ItemIconEntry, ItemIconManifest } from "@shared/itemIcons";

import lcdItemAtlasUrl from "../../../resources/items/lcd-core/items.png?url";
import lcdItemManifestData from "../../../resources/items/lcd-core/items.json";

/** Renderer-ready item icon atlas with parsed manifest and asset URL. */
export interface RuntimeItemIconSet {
  /** Parsed icon atlas and item metadata. */
  manifest: ItemIconManifest;
  /** Vite/Electron URL for the atlas image. */
  atlasUrl: string;
}

/** Default monochrome LCD item icon set. */
export const lcdItemIconSet: RuntimeItemIconSet = {
  manifest: ItemIconManifestSchema.parse(lcdItemManifestData),
  atlasUrl: lcdItemAtlasUrl
};

/**
 * Find an icon in the default LCD atlas.
 *
 * @param iconId - Icon identifier from the item manifest.
 * @returns Icon metadata, or undefined when missing.
 */
export function findLcdItemIcon(iconId: string): ItemIconEntry | undefined {
  return findItemIcon(lcdItemIconSet.manifest, iconId);
}
