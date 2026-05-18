import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { vi } from "vitest";

import { PetSource } from "@shared/domain";

import { createAssetUrl, DeskagotchiRuntime } from "./runtime";

vi.mock("electron", () => ({
  app: {
    getVersion: () => "0.1.0"
  },
  Notification: class {
    show(): void {
      return undefined;
    }
  }
}));

describe("runtime simulation safety", () => {
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

  it("keeps user-data custom packages out of the v0.1 runtime surface", async () => {
    const userDataDir = await createUserDataWithCustomBao();
    const runtime = new DeskagotchiRuntime(resourceRoot(), userDataDir);
    await runtime.initialize(new Date("2026-05-06T00:00:00.000Z"));

    const snapshot = await runtime.getSnapshot();
    const packageIds = snapshot.packages.map(
      (runtimePackage) => runtimePackage.petPackage.packageId
    );

    expect(packageIds).not.toContain("custom-bao");
    expect(
      snapshot.packages.every(
        (runtimePackage) => runtimePackage.petPackage.source === PetSource.BuiltIn
      )
    ).toBe(true);
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
  const userDataDir = await createUserDataDir();
  const runtime = new DeskagotchiRuntime(resourceRoot(), userDataDir);
  await runtime.initialize(new Date("2026-05-06T00:00:00.000Z"));
  return { runtime, userDataDir };
}

async function createUserDataWithCustomBao(): Promise<string> {
  const userDataDir = await createUserDataDir();
  const customPackageRoot = path.join(userDataDir, "custom-pets", "custom-bao");
  await mkdir(path.dirname(customPackageRoot), { recursive: true });
  await cp(path.join(resourceRoot(), "pets", "bao"), customPackageRoot, {
    recursive: true
  });

  const manifestPath = path.join(customPackageRoot, "pet.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    packageId: string;
    name: string;
    source: string;
  };
  manifest.packageId = "custom-bao";
  manifest.name = "Custom Bao";
  manifest.source = "custom";
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return userDataDir;
}

async function createUserDataDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "deskagotchi-user-"));
}

function resourceRoot(): string {
  return path.resolve(process.cwd(), "resources");
}
