/**
 * Runtime service for main-process state, package, and simulation operations.
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { app, Notification } from "electron";

import {
  DeskagotchiSaveSchema,
  type DeskagotchiSave,
  type PetInstanceState,
  type PetPackage,
  PetSource
} from "@shared/domain";
import {
  type CareActionRequest,
  type DeskagotchiSnapshot,
  type RuntimePetPackage,
  type UpdateSettingsInput
} from "@shared/ipc";
import { resolveCareItem } from "@shared/careItems";
import { ItemIconManifestSchema, type ItemIconManifest } from "@shared/itemIcons";
import {
  applyCareAction,
  createInitialPetState,
  DEFAULT_SIMULATION_CONFIG,
  progressPetState
} from "@shared/simulation";

import {
  loadPetPackagesFromDirectory,
  resolvePackageAssetPath,
  type LoadedPetPackage
} from "./packageRegistry";
import {
  createStoragePaths,
  type StoragePaths,
  loadOrCreateSave,
  writeDeskagotchiSave
} from "./storage";

/**
 * Coordinates persisted save state, pet packages, simulation progress, and notifications.
 *
 * The main process keeps a single runtime instance so IPC handlers and background
 * timers mutate one in-memory save before persisting it atomically.
 */
export class DeskagotchiRuntime {
  private readonly resourcePetsDir: string;
  private readonly resourceItemsDir: string;
  private readonly storagePaths: StoragePaths;
  private loadedPackages: LoadedPetPackage[] = [];
  private itemManifest: ItemIconManifest | undefined;
  private save: DeskagotchiSave | undefined;
  private persistQueue: Promise<void> = Promise.resolve();
  private lastNotificationAt = 0;

  /**
   * Create a runtime bound to packaged resources and Electron user data.
   *
   * @param resourceRoot - Directory containing built-in app resources.
   * @param userDataDir - Electron userData directory for saves and custom pets.
   */
  constructor(resourceRoot: string, userDataDir: string) {
    this.resourcePetsDir = path.join(resourceRoot, "pets");
    this.resourceItemsDir = path.join(resourceRoot, "items");
    this.storagePaths = createStoragePaths(userDataDir);
  }

  /**
   * Load pet packages, create or recover a save, and catch up active pet state.
   *
   * @param now - Clock value used for deterministic tests and offline catchup.
   * @throws Error when no valid pet package is available.
   */
  async initialize(now = new Date()): Promise<void> {
    await this.loadItemManifest();
    await this.reloadPackages();
    this.save = await loadOrCreateSave(
      this.storagePaths,
      this.loadedPackages.map((loadedPackage) => loadedPackage.petPackage),
      now
    );
    await this.progressActivePet(now);
  }

  /**
   * Return the active Electron userData directory.
   *
   * @returns Absolute path used for saves, custom pets, exports, and temp files.
   */
  getUserDataPath(): string {
    return this.storagePaths.userDataDir;
  }

  /**
   * Resolve a package asset path after verifying the package is loaded.
   *
   * @param packageId - Pet package identifier.
   * @param relativeAssetPath - Asset path declared by the package manifest.
   * @returns Absolute file path to the asset.
   * @throws Error when the package is unknown, undeclared, or escapes its package root.
   */
  resolveAsset(packageId: string, relativeAssetPath: string): string {
    const loadedPackage = this.getPetPackage(packageId);
    if (!isDeclaredPackageAsset(loadedPackage.petPackage, relativeAssetPath)) {
      throw new Error(
        `Asset path is not declared by package '${packageId}': ${relativeAssetPath}`
      );
    }
    return resolvePackageAssetPath(loadedPackage.packageRoot, relativeAssetPath);
  }

  /**
   * Return a renderer-ready snapshot without mutating simulation state.
   *
   * @returns Current save, active pet state, loaded packages, and app metadata.
   */
  async getSnapshot(): Promise<DeskagotchiSnapshot> {
    return this.createSnapshot();
  }

  /**
   * Progress the active pet, persist changes, and return a renderer-ready snapshot.
   *
   * @param now - Clock value used for simulation progress.
   * @returns Current save, active pet state, loaded packages, and app metadata.
   */
  async progressAndGetSnapshot(now = new Date()): Promise<DeskagotchiSnapshot> {
    await this.progressActivePet(now);
    return this.createSnapshot();
  }

  /**
   * Apply a care action to the active pet and persist the result.
   *
   * @param request - Care action requested by the user.
   * @param now - Clock value used by simulation and action effects.
   * @returns Updated renderer snapshot.
   */
  async performAction(
    request: CareActionRequest,
    now = new Date()
  ): Promise<DeskagotchiSnapshot> {
    const save = this.requireSave();
    const activeState = this.getActiveState(save);
    const activePackage = this.getPetPackage(activeState.packageId);
    const item = resolveCareItem(request, this.requireItemManifest());
    const actionResult = applyCareAction(activeState, activePackage.petPackage, {
      type: request.type,
      now,
      item
    });
    this.replaceInstance(actionResult.state);
    await this.persistSave();
    return this.createSnapshot();
  }

  /**
   * Make a package the active pet, creating its first instance if needed.
   *
   * @param packageId - Pet package to activate.
   * @param now - Clock value used when creating a new pet instance.
   * @returns Updated renderer snapshot.
   * @throws Error when the package is not loaded.
   */
  async switchPet(packageId: string, now = new Date()): Promise<DeskagotchiSnapshot> {
    const save = this.requireSave();
    const selectedPackage = this.getPetPackage(packageId);
    const existingInstance = save.instances.find(
      (instance) => instance.packageId === packageId
    );
    const selectedInstance =
      existingInstance ??
      createInitialPetState(
        selectedPackage.petPackage,
        selectedPackage.petPackage.name,
        now,
        `${packageId}-${randomUUID()}`
      );

    this.save = {
      ...save,
      activeInstanceId: selectedInstance.instanceId,
      instances: existingInstance
        ? save.instances
        : [...save.instances, selectedInstance]
    };

    await this.progressActivePet(now);
    await this.persistSave();
    return this.createSnapshot();
  }

  /**
   * Merge user settings into the persisted save.
   *
   * @param settings - Partial settings supplied by the renderer.
   * @param now - Clock value used to progress the active pet before snapshotting.
   * @returns Updated renderer snapshot.
   */
  async updateSettings(
    settings: UpdateSettingsInput,
    now = new Date()
  ): Promise<DeskagotchiSnapshot> {
    const save = this.requireSave();
    this.save = {
      ...save,
      settings: {
        ...save.settings,
        ...settings
      }
    };
    await this.progressActivePet(now);
    await this.persistSave();
    return this.createSnapshot();
  }

  /**
   * Persist the last known pet overlay bounds.
   *
   * @param bounds - Electron window bounds to restore on next packaged launch.
   */
  async updatePetWindowBounds(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<void> {
    const save = this.requireSave();
    this.save = {
      ...save,
      settings: {
        ...save.settings,
        petWindowBounds: bounds
      }
    };
    await this.persistSave();
  }

  /**
   * Show a native notification when the active pet needs attention.
   *
   * @param now - Clock value used for quiet-hours and cooldown checks.
   */
  maybeNotifyAttention(now = new Date()): void {
    const save = this.requireSave();
    if (!save.settings.notificationsEnabled) {
      return;
    }
    const activeState = this.getActiveState(save);
    const needsAttention =
      activeState.isSick ||
      activeState.stats.hunger < 20 ||
      activeState.stats.cleanliness < 20 ||
      activeState.messCount > 0;
    const cooldownMs = save.settings.notificationCooldownMinutes * 60_000;
    if (
      !needsAttention ||
      isQuietHours(now, save.settings.quietHoursEnabled, save.settings.quietHoursStart, save.settings.quietHoursEnd) ||
      now.getTime() - this.lastNotificationAt < cooldownMs
    ) {
      return;
    }
    this.lastNotificationAt = now.getTime();
    new Notification({
      title: "Deskagotchi needs attention",
      body: `${activeState.nickname} could use a quick check-in.`
    }).show();
  }

  private async reloadPackages(): Promise<void> {
    const builtInPackages = await loadPetPackagesFromDirectory(
      this.resourcePetsDir,
      PetSource.BuiltIn
    );
    const customPackages = await loadPetPackagesFromDirectory(
      this.storagePaths.customPetsDir,
      PetSource.Custom
    );
    this.loadedPackages = [...builtInPackages.packages, ...customPackages.packages];
    if (this.loadedPackages.length === 0) {
      throw new Error("Deskagotchi could not find any valid pet packages.");
    }
  }

  private async progressActivePet(now: Date): Promise<void> {
    const save = this.requireSave();
    const activeState = this.getActiveState(save);
    const activePackage = this.getPetPackage(activeState.packageId);
    const progressed = progressPetState(
      activeState,
      activePackage.petPackage,
      now,
      createRuntimeSimulationConfig(save)
    );
    this.replaceInstance(progressed.state);
    await this.persistSave();
  }

  private createSnapshot(): DeskagotchiSnapshot {
    const save = this.requireSave();
    const activeState = this.getActiveState(save);
    const packages = this.loadedPackages.map((loadedPackage) =>
      this.toRuntimePackage(loadedPackage)
    );
    const activePackage = packages.find(
      (runtimePackage) =>
        runtimePackage.petPackage.packageId === activeState.packageId
    );

    if (activePackage === undefined) {
      throw new Error(`Active package '${activeState.packageId}' is unavailable.`);
    }

    return {
      save,
      activeState,
      activePackage,
      packages,
      appVersion: app.getVersion(),
      userDataPath: this.storagePaths.userDataDir
    };
  }

  private toRuntimePackage(loadedPackage: LoadedPetPackage): RuntimePetPackage {
    const packageId = loadedPackage.petPackage.packageId;
    const assetVersion =
      loadedPackage.petPackage.assetHash ?? loadedPackage.petPackage.assetVersion;
    return {
      petPackage: loadedPackage.petPackage,
      assetUrls: {
        spritesheet: createAssetUrl(
          packageId,
          loadedPackage.petPackage.assets.spritesheet,
          assetVersion
        ),
        preview: createAssetUrl(
          packageId,
          loadedPackage.petPackage.assets.preview,
          assetVersion
        ),
        icon: createAssetUrl(
          packageId,
          loadedPackage.petPackage.assets.icon,
          assetVersion
        )
      },
      issues: loadedPackage.issues
    };
  }

  private async loadItemManifest(): Promise<void> {
    const itemManifestPath = path.join(this.resourceItemsDir, "lcd-core", "items.json");
    const rawManifest = await readFile(itemManifestPath, "utf8");
    this.itemManifest = ItemIconManifestSchema.parse(JSON.parse(rawManifest));
  }

  private requireItemManifest(): ItemIconManifest {
    if (this.itemManifest === undefined) {
      throw new Error("Item manifest has not been loaded.");
    }
    return this.itemManifest;
  }

  private getPetPackage(packageId: string): LoadedPetPackage {
    const petPackage = this.loadedPackages.find(
      (loadedPackage) => loadedPackage.petPackage.packageId === packageId
    );
    if (petPackage === undefined) {
      throw new Error(`Unknown pet package '${packageId}'.`);
    }
    return petPackage;
  }

  private getActiveState(save: DeskagotchiSave): PetInstanceState {
    const activeState = save.instances.find(
      (instance) => instance.instanceId === save.activeInstanceId
    );
    if (activeState === undefined) {
      throw new Error("Active pet instance is missing from the save file.");
    }
    return activeState;
  }

  private replaceInstance(instance: PetInstanceState): void {
    const save = this.requireSave();
    this.save = {
      ...save,
      instances: save.instances.map((candidate) =>
        candidate.instanceId === instance.instanceId ? instance : candidate
      )
    };
  }

  private async persistSave(): Promise<void> {
    const save = this.requireSave();
    const parsed = DeskagotchiSaveSchema.parse(save);
    const writeOperation = this.persistQueue
      .catch(() => undefined)
      .then(() => writeDeskagotchiSave(this.storagePaths, parsed));
    this.persistQueue = writeOperation.catch(() => undefined);
    await writeOperation;
  }

  private requireSave(): DeskagotchiSave {
    if (this.save === undefined) {
      throw new Error("Deskagotchi runtime has not been initialized.");
    }
    return this.save;
  }
}

/**
 * Create the simulation config implied by save-level maintenance settings.
 *
 * @param save - Current persisted save.
 * @returns Default or low-maintenance simulation configuration.
 */
function createRuntimeSimulationConfig(save: DeskagotchiSave): typeof DEFAULT_SIMULATION_CONFIG {
  if (!save.settings.lowMaintenanceMode) {
    return DEFAULT_SIMULATION_CONFIG;
  }

  return {
    ...DEFAULT_SIMULATION_CONFIG,
    maxOfflineCatchupHours: 18,
    decayPerHour: {
      hunger: DEFAULT_SIMULATION_CONFIG.decayPerHour.hunger * 0.55,
      happiness: DEFAULT_SIMULATION_CONFIG.decayPerHour.happiness * 0.55,
      energy: DEFAULT_SIMULATION_CONFIG.decayPerHour.energy * 0.65,
      cleanliness: DEFAULT_SIMULATION_CONFIG.decayPerHour.cleanliness * 0.55
    },
    healthPenaltyPerHour: DEFAULT_SIMULATION_CONFIG.healthPenaltyPerHour * 0.5
  };
}

/**
 * Check whether a requested protocol asset is one of the package's declared files.
 *
 * @param petPackage - Package manifest that owns the asset declarations.
 * @param relativeAssetPath - Requested package-relative asset path.
 * @returns True when the path matches spritesheet, preview, or icon.
 */
function isDeclaredPackageAsset(
  petPackage: PetPackage,
  relativeAssetPath: string
): boolean {
  const normalizedPath = normalizeManifestAssetPath(relativeAssetPath);
  return [
    petPackage.assets.spritesheet,
    petPackage.assets.preview,
    petPackage.assets.icon
  ].some((assetPath) => normalizeManifestAssetPath(assetPath) === normalizedPath);
}

/**
 * Normalize package asset paths to match manifest paths across OS separators.
 *
 * @param relativeAssetPath - Package-relative asset path.
 * @returns Slash-delimited path for manifest comparisons.
 */
function normalizeManifestAssetPath(relativeAssetPath: string): string {
  return relativeAssetPath.replaceAll("\\", "/");
}

/**
 * Determine whether native notifications should be suppressed for quiet hours.
 *
 * @param now - Current local time.
 * @param enabled - Whether quiet hours are active.
 * @param quietHoursStart - Start clock in HH:mm format.
 * @param quietHoursEnd - End clock in HH:mm format.
 * @returns True when the current local time falls inside the quiet-hour window.
 */
function isQuietHours(
  now: Date,
  enabled: boolean,
  quietHoursStart: string,
  quietHoursEnd: string
): boolean {
  if (!enabled) {
    return false;
  }

  const startMinutes = parseClockMinutes(quietHoursStart);
  const endMinutes = parseClockMinutes(quietHoursEnd);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (startMinutes === endMinutes) {
    return false;
  }
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function parseClockMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

/**
 * Create the renderer URL for a package asset served by the custom protocol.
 *
 * @param packageId - Pet package identifier.
 * @param relativeAssetPath - Slash-delimited asset path inside the package.
 * @param assetVersion - Optional asset hash or version used for renderer cache busting.
 * @returns Encoded deskagotchi protocol URL.
 */
export function createAssetUrl(
  packageId: string,
  relativeAssetPath: string,
  assetVersion?: string
): string {
  const assetPath = `deskagotchi://pet-asset/${encodeURIComponent(packageId)}/${relativeAssetPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
  if (assetVersion === undefined) {
    return assetPath;
  }

  return `${assetPath}?v=${encodeURIComponent(assetVersion)}`;
}
