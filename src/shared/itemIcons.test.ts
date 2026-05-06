import { readFileSync } from "node:fs";
import path from "node:path";

import {
  ItemCategory,
  ItemIconManifestSchema
} from "./itemIcons";

import itemManifest from "../../resources/items/lcd-core/items.json";

describe("LCD item icon manifest", () => {
  it("parses the committed LCD item atlas manifest", () => {
    const parsedManifest = ItemIconManifestSchema.parse(itemManifest);

    expect(parsedManifest.itemSetId).toBe("lcd-core");
    expect(parsedManifest.icons).toHaveLength(26);
    expect(parsedManifest.items.length).toBeGreaterThanOrEqual(16);
  });

  it("contains the MVP item categories and unique icon ids", () => {
    const parsedManifest = ItemIconManifestSchema.parse(itemManifest);
    const categories = new Set(parsedManifest.icons.map((icon) => icon.category));
    const iconIds = parsedManifest.icons.map((icon) => icon.id);

    expect(categories).toEqual(
      new Set([
        ItemCategory.Meal,
        ItemCategory.Snack,
        ItemCategory.Toy,
        ItemCategory.Medicine,
        ItemCategory.Clean,
        ItemCategory.Sleep,
        ItemCategory.Status
      ])
    );
    expect(new Set(iconIds).size).toBe(iconIds.length);
  });

  it("keeps item references and atlas dimensions valid", () => {
    const parsedManifest = ItemIconManifestSchema.parse(itemManifest);
    const iconIds = new Set(parsedManifest.icons.map((icon) => icon.id));
    const atlasPath = path.resolve(
      process.cwd(),
      "resources",
      "items",
      parsedManifest.itemSetId,
      parsedManifest.atlas
    );
    const atlas = readFileSync(atlasPath);
    const width = atlas.readUInt32BE(16);
    const height = atlas.readUInt32BE(20);
    const maxRow = Math.max(...parsedManifest.icons.map((icon) => icon.row));

    expect(width).toBe(parsedManifest.columns * parsedManifest.cellWidth);
    expect(height).toBe((maxRow + 1) * parsedManifest.cellHeight);
    expect(parsedManifest.items.every((item) => iconIds.has(item.iconId))).toBe(true);
  });
});
