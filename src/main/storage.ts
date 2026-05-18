/**
 * Save-file and userData storage helpers for the Electron main process.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CURRENT_DESKAGOTCHI_SAVE_SCHEMA_VERSION,
  DeskagotchiSaveSchema,
  type DeskagotchiSave,
  type PetPackage
} from "@shared/domain";
import { createInitialPetState } from "@shared/simulation";

const ATOMIC_RENAME_RETRY_DELAYS_MS = [25, 50, 100, 200];

/**
 * Absolute paths owned by the Electron userData storage area.
 */
export interface StoragePaths {
  /** Root Electron userData directory. */
  userDataDir: string;
  /** Primary persisted save file. */
  saveFile: string;
  /** Last valid save copied before the primary save is replaced. */
  backupSaveFile: string;
  /** Directory containing installed custom pet packages. */
  customPetsDir: string;
  /** Directory where exported pet archives are written. */
  exportsDir: string;
}

/**
 * Build the storage layout for a userData root.
 *
 * @param userDataDir - Electron userData directory.
 * @returns Absolute paths used by runtime persistence.
 */
export function createStoragePaths(userDataDir: string): StoragePaths {
  return {
    userDataDir,
    saveFile: path.join(userDataDir, "deskagotchi-save.json"),
    backupSaveFile: path.join(userDataDir, "deskagotchi-save.backup.json"),
    customPetsDir: path.join(userDataDir, "custom-pets"),
    exportsDir: path.join(userDataDir, "exports")
  };
}

/**
 * Ensure all runtime-owned storage directories exist.
 *
 * @param paths - Storage layout to create.
 */
export async function ensureStorageDirectories(paths: StoragePaths): Promise<void> {
  await Promise.all([
    mkdir(paths.userDataDir, { recursive: true }),
    mkdir(paths.customPetsDir, { recursive: true }),
    mkdir(paths.exportsDir, { recursive: true })
  ]);
}

/**
 * Create the first save file for a new Deskagotchi installation.
 *
 * @param petPackages - Available packages used to seed the first active pet.
 * @param now - Clock value used for initial pet timestamps.
 * @returns New save object ready for schema validation and persistence.
 * @throws Error when no pet package is available.
 */
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
    schemaVersion: CURRENT_DESKAGOTCHI_SAVE_SCHEMA_VERSION,
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
      clickThroughWhenIdle: true,
      petWindowBounds: {
        x: 80,
        y: 80,
        width: 180,
        height: 180
      }
    }
  };
}

/**
 * Load the primary save, recover from backup, or create a default save.
 *
 * @param paths - Storage layout for the current userData root.
 * @param petPackages - Valid packages available for default save creation.
 * @param now - Clock value used if a new save is created.
 * @returns Valid Deskagotchi save.
 */
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

/**
 * Validate and persist the save, copying the previous valid save to backup first.
 *
 * @param paths - Storage layout for the current userData root.
 * @param save - Save object to validate and persist.
 * @throws Error when the save does not satisfy the schema.
 */
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

/**
 * Write JSON through a temporary file and final rename.
 *
 * @param filePath - Destination file path.
 * @param value - JSON-serializable value to write.
 */
export async function writeJsonAtomic(
  filePath: string,
  value: unknown
): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const tempFile = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`
  );

  await writeFile(tempFile, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await renameWithWindowsRetry(tempFile, filePath);
  } catch (error) {
    await rm(tempFile, { force: true });
    throw error;
  }
}

/**
 * Read and schema-validate a save file.
 *
 * @param filePath - Save file to read.
 * @returns Parsed save, or undefined when missing, unreadable, or invalid.
 */
async function readSaveFile(filePath: string): Promise<DeskagotchiSave | undefined> {
  let raw: string | undefined;
  try {
    raw = await readFile(filePath, "utf8");
    const parsedJson = JSON.parse(raw) as unknown;
    const migratedJson = migrateDeskagotchiSave(parsedJson);
    const parsedSave = DeskagotchiSaveSchema.safeParse(migratedJson);
    if (parsedSave.success) {
      return parsedSave.data;
    }
    await preserveInvalidSave(filePath, raw, "schema");
    return undefined;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    if (raw !== undefined) {
      await preserveInvalidSave(filePath, raw, "parse");
    }
    return undefined;
  }
}

/**
 * Migrate older save payloads into the current schema shape before validation.
 *
 * @param value - JSON payload read from disk.
 * @returns Payload compatible with the current save schema when migration exists.
 */
export function migrateDeskagotchiSave(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const candidate = value as { schemaVersion?: unknown };
  const version = candidate.schemaVersion ?? CURRENT_DESKAGOTCHI_SAVE_SCHEMA_VERSION;
  if (version === CURRENT_DESKAGOTCHI_SAVE_SCHEMA_VERSION) {
    return {
      ...candidate,
      schemaVersion: CURRENT_DESKAGOTCHI_SAVE_SCHEMA_VERSION
    };
  }

  return value;
}

async function preserveInvalidSave(
  filePath: string,
  raw: string,
  reason: "parse" | "schema"
): Promise<void> {
  const directory = path.dirname(filePath);
  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(".", "-");
  const preservedPath = path.join(
    directory,
    `${path.basename(filePath)}.${timestamp}.${reason}.invalid`
  );
  await writeFile(preservedPath, raw, "utf8");
}

/**
 * Copy the current valid save to the backup path before replacement.
 *
 * @param paths - Storage layout containing primary and backup save paths.
 */
async function copyCurrentSaveToBackup(paths: StoragePaths): Promise<void> {
  const currentSave = await readSaveFile(paths.saveFile);
  if (currentSave !== undefined) {
    await writeJsonAtomic(paths.backupSaveFile, currentSave);
  }
}

async function renameWithWindowsRetry(
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  let lastError: unknown;
  for (const delayMs of [0, ...ATOMIC_RENAME_RETRY_DELAYS_MS]) {
    if (delayMs > 0) {
      await delay(delayMs);
    }
    try {
      await rename(sourcePath, destinationPath);
      return;
    } catch (error) {
      if (!isRetryableRenameError(error)) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError;
}

function isRetryableRenameError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "EPERM" || error.code === "EACCES" || error.code === "EBUSY")
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
