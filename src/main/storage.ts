import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeskagotchiSaveSchema,
  type DeskagotchiSave,
  type PetPackage
} from "@shared/domain";
import { createInitialPetState } from "@shared/simulation";

export interface StoragePaths {
  userDataDir: string;
  saveFile: string;
  backupSaveFile: string;
  customPetsDir: string;
  hatchDraftsDir: string;
  exportsDir: string;
  tempDir: string;
}

export function createStoragePaths(userDataDir: string): StoragePaths {
  return {
    userDataDir,
    saveFile: path.join(userDataDir, "deskagotchi-save.json"),
    backupSaveFile: path.join(userDataDir, "deskagotchi-save.backup.json"),
    customPetsDir: path.join(userDataDir, "custom-pets"),
    hatchDraftsDir: path.join(userDataDir, "hatch-drafts"),
    exportsDir: path.join(userDataDir, "exports"),
    tempDir: path.join(userDataDir, "tmp")
  };
}

export async function ensureStorageDirectories(paths: StoragePaths): Promise<void> {
  await Promise.all([
    mkdir(paths.userDataDir, { recursive: true }),
    mkdir(paths.customPetsDir, { recursive: true }),
    mkdir(paths.hatchDraftsDir, { recursive: true }),
    mkdir(paths.exportsDir, { recursive: true }),
    mkdir(paths.tempDir, { recursive: true })
  ]);
}

export function createDefaultSave(
  petPackages: PetPackage[],
  now: Date
): DeskagotchiSave {
  const firstPackage = petPackages[0];
  if (firstPackage === undefined) {
    throw new Error("Cannot create a Deskagotchi save without a pet package.");
  }

  const instance = createInitialPetState(firstPackage, firstPackage.name, now);

  return {
    schemaVersion: 1,
    activeInstanceId: instance.instanceId,
    instances: [instance],
    settings: {
      alwaysOnTop: true,
      launchOnStartup: false,
      soundEnabled: true,
      reducedMotion: false,
      lowMaintenanceMode: false,
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      notificationsEnabled: true,
      notificationCooldownMinutes: 90,
      clickThroughWhenIdle: false,
      petWindowBounds: {
        x: 80,
        y: 80,
        width: 180,
        height: 180
      }
    }
  };
}

export async function loadOrCreateSave(
  paths: StoragePaths,
  petPackages: PetPackage[],
  now: Date
): Promise<DeskagotchiSave> {
  await ensureStorageDirectories(paths);

  const loadedSave = await readSaveFile(paths.saveFile);
  if (loadedSave !== undefined) {
    return loadedSave;
  }

  const backupSave = await readSaveFile(paths.backupSaveFile);
  if (backupSave !== undefined) {
    await writeJsonAtomic(paths.saveFile, backupSave);
    return backupSave;
  }

  const defaultSave = createDefaultSave(petPackages, now);
  await writeDeskagotchiSave(paths, defaultSave);
  return defaultSave;
}

export async function writeDeskagotchiSave(
  paths: StoragePaths,
  save: DeskagotchiSave
): Promise<void> {
  const parsed = DeskagotchiSaveSchema.safeParse(save);
  if (!parsed.success) {
    throw new Error(`Refusing to persist invalid save: ${parsed.error.message}`);
  }

  await ensureStorageDirectories(paths);
  await copyCurrentSaveToBackup(paths);
  await writeJsonAtomic(paths.saveFile, parsed.data);
}

export async function writeJsonAtomic(
  filePath: string,
  value: unknown
): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const tempFile = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );

  await writeFile(tempFile, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempFile, filePath);
}

async function readSaveFile(filePath: string): Promise<DeskagotchiSave | undefined> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsedJson = JSON.parse(raw) as unknown;
    const parsedSave = DeskagotchiSaveSchema.safeParse(parsedJson);
    return parsedSave.success ? parsedSave.data : undefined;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    return undefined;
  }
}

async function copyCurrentSaveToBackup(paths: StoragePaths): Promise<void> {
  const currentSave = await readSaveFile(paths.saveFile);
  if (currentSave !== undefined) {
    await writeJsonAtomic(paths.backupSaveFile, currentSave);
  }
}
