import { mkdtemp, readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import AdmZip from "adm-zip";
import { vi } from "vitest";

import { PetSource } from "@shared/domain";
import { createTestPetPackage } from "@shared/fixtures";

import { createAssetUrl, DeskagotchiRuntime } from "./runtime";

const electronMocks = vi.hoisted(() => ({
  showOpenDialog: vi.fn()
}));

vi.mock("electron", () => ({
  app: {
    getVersion: () => "0.1.0"
  },
  dialog: {
    showOpenDialog: electronMocks.showOpenDialog
  },
  Notification: class {
    show(): void {
      return undefined;
    }
  }
}));

describe("runtime import and simulation safety", () => {
  beforeEach(() => {
    electronMocks.showOpenDialog.mockReset();
  });

  it("removes partial import folders when an archive path is unsafe", async () => {
    const { runtime, userDataDir } = await createInitializedRuntime();
    const archivePath = await writeArchive("unsafe-path", (archive) => {
      archive.addFile("escape.txt", Buffer.from("nope"));
      const [entry] = archive.getEntries();
      if (entry !== undefined) {
        entry.entryName = "../escape.txt";
      }
    });
    electronMocks.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [archivePath]
    });

    await expect(runtime.importPet()).rejects.toThrow("Unsafe archive path");

    await expectCustomPets(userDataDir, []);
  });

  it("removes partial import folders when cumulative uncompressed bytes are too large", async () => {
    const { runtime, userDataDir } = await createInitializedRuntime();
    const oneMegabyte = Buffer.alloc(1024 * 1024, "a");
    const archivePath = await writeArchive("too-large-uncompressed", (archive) => {
      for (let index = 0; index < 26; index += 1) {
        archive.addFile(`asset-${index}.txt`, oneMegabyte);
      }
    });
    electronMocks.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [archivePath]
    });

    await expect(runtime.importPet()).rejects.toThrow("uncompressed size limit");

    await expectCustomPets(userDataDir, []);
  });

  it("removes partial import folders when validation fails", async () => {
    const { runtime, userDataDir } = await createInitializedRuntime();
    const archivePath = await writeArchive("invalid-package", (archive) => {
      archive.addFile("preview.svg", Buffer.from("<svg />"));
    });
    electronMocks.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [archivePath]
    });

    await expect(runtime.importPet()).rejects.toThrow("failed validation");

    await expectCustomPets(userDataDir, []);
  });

  it("rejects imported custom packages that reuse an existing package id", async () => {
    const { runtime, userDataDir } = await createInitializedRuntime();
    const duplicatePackage = createTestPetPackage({
      packageId: "bao",
      source: PetSource.Custom,
      name: "Duplicate Bao"
    });
    const archivePath = await writeArchive("duplicate-bao", (archive) => {
      archive.addFile("pet.json", Buffer.from(JSON.stringify(duplicatePackage)));
      archive.addFile("spritesheet.svg", Buffer.from("<svg />"));
      archive.addFile("preview.svg", Buffer.from("<svg />"));
      archive.addFile("icon.svg", Buffer.from("<svg />"));
    });
    electronMocks.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [archivePath]
    });

    await expect(runtime.importPet()).rejects.toThrow("existing package id");

    await expectCustomPets(userDataDir, []);
  });

  it("rejects overlapping imports before opening a second file dialog", async () => {
    const { runtime } = await createInitializedRuntime();
    let resolveDialog:
      | ((selection: { canceled: true; filePaths: string[] }) => void)
      | undefined;
    electronMocks.showOpenDialog.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDialog = resolve;
      })
    );

    const firstImport = runtime.importPet();
    await expect(runtime.importPet()).rejects.toThrow("already in progress");
    expect(electronMocks.showOpenDialog).toHaveBeenCalledTimes(1);

    resolveDialog?.({ canceled: true, filePaths: [] });
    await expect(firstImport).resolves.toBeDefined();
  });

  it("keeps snapshot reads separate from simulation progression", async () => {
    const { runtime } = await createInitializedRuntime();
    const initialSnapshot = await runtime.getSnapshot();
    const progressedSnapshot = await runtime.progressAndGetSnapshot(
      new Date("2026-05-07T00:00:00.000Z")
    );
    const readOnlySnapshot = await runtime.getSnapshot();

    expect(initialSnapshot.activeState.ageHours).toBe(0);
    expect(progressedSnapshot.activeState.ageHours).toBeCloseTo(24, 3);
    expect(readOnlySnapshot.activeState.ageHours).toBe(
      progressedSnapshot.activeState.ageHours
    );
  });

  it("applies low-maintenance offline catch-up when the setting is enabled", async () => {
    const standardRuntime = await createInitializedRuntime();
    const lowMaintenanceRuntime = await createInitializedRuntime();
    const fiveDaysLater = new Date("2026-05-11T00:00:00.000Z");

    const standardSnapshot = await standardRuntime.runtime.progressAndGetSnapshot(
      fiveDaysLater
    );
    await lowMaintenanceRuntime.runtime.updateSettings(
      { lowMaintenanceMode: true },
      new Date("2026-05-06T00:00:00.000Z")
    );
    const lowMaintenanceSnapshot =
      await lowMaintenanceRuntime.runtime.progressAndGetSnapshot(fiveDaysLater);

    expect(standardSnapshot.activeState.offlineDebtHours).toBeCloseTo(84, 3);
    expect(lowMaintenanceSnapshot.activeState.offlineDebtHours).toBeCloseTo(102, 3);
    expect(lowMaintenanceSnapshot.activeState.stats.hunger).toBeGreaterThan(
      standardSnapshot.activeState.stats.hunger
    );
  });

  it("serializes overlapping save writes from runtime mutations", async () => {
    const { runtime, userDataDir } = await createInitializedRuntime();

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        runtime.updatePetWindowBounds({
          x: 80 + index,
          y: 90 + index,
          width: 180,
          height: 180
        })
      )
    );

    const rawSave = await readFile(
      path.join(userDataDir, "deskagotchi-save.json"),
      "utf8"
    );
    const saved = JSON.parse(rawSave) as {
      settings: { petWindowBounds?: { x: number; y: number } };
    };
    expect(saved.settings.petWindowBounds).toMatchObject({ x: 87, y: 97 });
  });
});

describe("asset URLs", () => {
  it("includes an optional asset version query to bust renderer cache", () => {
    expect(createAssetUrl("bao", "spritesheet.png", "hash v3")).toBe(
      "deskagotchi://pet-asset/bao/spritesheet.png?v=hash%20v3"
    );
  });

  it("rejects package-root files that are not declared assets", async () => {
    const { runtime } = await createInitializedRuntime();

    expect(() => runtime.resolveAsset("bao", "pet.json")).toThrow(
      "not declared"
    );
  });
});

async function createInitializedRuntime(): Promise<{
  runtime: DeskagotchiRuntime;
  userDataDir: string;
}> {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "deskagotchi-user-"));
  const runtime = new DeskagotchiRuntime(resourceRoot(), userDataDir);
  await runtime.initialize(new Date("2026-05-06T00:00:00.000Z"));
  return { runtime, userDataDir };
}

async function writeArchive(
  name: string,
  addEntries: (archive: AdmZip) => void
): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "deskagotchi-archive-"));
  const archivePath = path.join(tempDir, `${name}.deskagotchi-pet`);
  const archive = new AdmZip();
  addEntries(archive);
  archive.writeZip(archivePath);
  return archivePath;
}

async function expectCustomPets(
  userDataDir: string,
  expectedEntries: string[]
): Promise<void> {
  const customPetsDir = path.join(userDataDir, "custom-pets");
  let entries: string[] = [];
  try {
    entries = await readdir(customPetsDir);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
  expect(entries).toEqual(expectedEntries);
}

function resourceRoot(): string {
  return path.resolve(process.cwd(), "resources");
}
