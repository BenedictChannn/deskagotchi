import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createTestPetPackage } from "@shared/fixtures";

import {
  createStoragePaths,
  loadOrCreateSave,
  writeDeskagotchiSave
} from "./storage";

describe("storage", () => {
  it("creates a default save when no save exists", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "deskagotchi-storage-"));
    const paths = createStoragePaths(tempDir);
    const save = await loadOrCreateSave(
      paths,
      [createTestPetPackage()],
      new Date("2026-05-05T00:00:00.000Z")
    );

    expect(save.instances).toHaveLength(1);
    expect(save.activeInstanceId).toBe(save.instances[0]?.instanceId);
    expect(save.instances[0]?.careDeadlines).toEqual({
      hunger: null,
      happiness: null,
      mess: null,
      sickness: null,
      sleep: null
    });
    await expect(readFile(paths.saveFile, "utf8")).resolves.toContain(
      "activeInstanceId"
    );
  });

  it("keeps a backup when replacing an existing save", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "deskagotchi-storage-"));
    const paths = createStoragePaths(tempDir);
    const save = await loadOrCreateSave(
      paths,
      [createTestPetPackage()],
      new Date("2026-05-05T00:00:00.000Z")
    );

    await writeDeskagotchiSave(paths, {
      ...save,
      settings: {
        ...save.settings,
        alwaysOnTop: false
      }
    });

    await expect(readFile(paths.backupSaveFile, "utf8")).resolves.toContain(
      "\"alwaysOnTop\": true"
    );
  });

  it("falls back to a valid backup when the primary save is corrupt", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "deskagotchi-storage-"));
    const paths = createStoragePaths(tempDir);
    const save = await loadOrCreateSave(
      paths,
      [createTestPetPackage()],
      new Date("2026-05-05T00:00:00.000Z")
    );

    await writeFile(paths.saveFile, "{", "utf8");
    await writeFile(paths.backupSaveFile, `${JSON.stringify(save, null, 2)}\n`, "utf8");

    const recoveredSave = await loadOrCreateSave(
      paths,
      [createTestPetPackage()],
      new Date("2026-05-05T01:00:00.000Z")
    );

    expect(recoveredSave.activeInstanceId).toBe(save.activeInstanceId);
  });

  it("loads older saves that do not yet contain explicit care deadlines", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "deskagotchi-storage-"));
    const paths = createStoragePaths(tempDir);
    const save = await loadOrCreateSave(
      paths,
      [createTestPetPackage()],
      new Date("2026-05-05T00:00:00.000Z")
    );
    const legacySave = JSON.parse(JSON.stringify(save)) as {
      instances: Array<Record<string, unknown>>;
    };
    delete legacySave.instances[0]?.careDeadlines;
    await writeFile(paths.saveFile, `${JSON.stringify(legacySave, null, 2)}\n`, "utf8");

    const loadedSave = await loadOrCreateSave(
      paths,
      [createTestPetPackage()],
      new Date("2026-05-05T01:00:00.000Z")
    );

    expect(loadedSave.activeInstanceId).toBe(save.activeInstanceId);
    expect(loadedSave.instances[0]?.careDeadlines).toBeUndefined();
  });
});
