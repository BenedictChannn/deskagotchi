import { mkdtemp, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import AdmZip from "adm-zip";
import { vi } from "vitest";

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

describe("runtime import and hatch safety", () => {
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

  it("rejects hatch drafts with empty required manifest fields before writing files", async () => {
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "deskagotchi-user-"));
    const runtime = new DeskagotchiRuntime(resourceRoot(), userDataDir);

    const result = await runtime.hatchCreateDraft({
      name: "Momo",
      description: "",
      species: "",
      personality: "",
      preferredColors: ["#4ecdc4", "#fff4d6"]
    });

    expect(result.installed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "hatch_description_invalid",
        "hatch_species_invalid",
        "hatch_personality_invalid"
      ])
    );
    await expectCustomPets(userDataDir, []);
  });
});

describe("asset URLs", () => {
  it("includes an optional asset version query to bust renderer cache", () => {
    expect(createAssetUrl("deskdog", "spritesheet.png", "hash v3")).toBe(
      "deskagotchi://pet-asset/deskdog/spritesheet.png?v=hash%20v3"
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
