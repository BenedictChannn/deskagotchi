/**
 * Runtime service for main-process state, package, and simulation operations.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import AdmZip from "adm-zip";
import { app, dialog, Notification } from "electron";

import {
  AnimationId,
  CareActionType,
  DeskagotchiSaveSchema,
  type DeskagotchiSave,
  LifeStage,
  PackageValidationStatus,
  type PetInstanceState,
  type PetPackage,
  PetSource,
  PlayStyle,
  type ValidationIssue
} from "@shared/domain";
import {
  type HatchDraftInput,
  validateHatchDraftInput
} from "@shared/hatch";
import {
  type CareActionRequest,
  type DeskagotchiSnapshot,
  type HatchDraftResult,
  type RuntimePetPackage,
  type UpdateSettingsInput
} from "@shared/ipc";
import {
  ItemCategory,
  ItemIconManifestSchema,
  type ItemCatalogEntry,
  type ItemIconManifest
} from "@shared/itemIcons";
import { hasBlockingIssues } from "@shared/packageValidation";
import {
  applyCareAction,
  createInitialPetState,
  DEFAULT_SIMULATION_CONFIG,
  progressPetState
} from "@shared/simulation";

import {
  loadPetPackagesFromDirectory,
  loadPetPackage,
  resolvePackageAssetPath,
  type LoadedPetPackage
} from "./packageRegistry";
import {
  createStoragePaths,
  type StoragePaths,
  loadOrCreateSave,
  writeDeskagotchiSave,
  writeJsonAtomic
} from "./storage";

const IMAGEGEN_PLACEHOLDER_NOTE =
  "This local draft is ready for replacement by the approved imagegen pipeline.";
const MAX_IMPORTED_PACKAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMPORTED_PACKAGE_ENTRIES = 128;
const HATCH_PLACEHOLDER_ANIMATION_IDS = [
  AnimationId.Idle,
  AnimationId.Happy,
  AnimationId.Walking,
  AnimationId.Sleeping,
  AnimationId.Sick
];

/**
 * Coordinates persisted save state, pet packages, simulation progress, and native dialogs.
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
    const item = this.resolveCareItem(request);
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

  /**
   * Create and install a local placeholder pet package from hatch input.
   *
   * @param input - User-provided hatch prompt details and preferred colors.
   * @returns Installation result and package validation issues.
   */
  async hatchCreateDraft(input: HatchDraftInput): Promise<HatchDraftResult> {
    const safetyIssues = validateHatchDraftInput(input);
    if (hasBlockingIssues(safetyIssues)) {
      return {
        packageId: "",
        installed: false,
        issues: safetyIssues
      };
    }

    const packageId = slugify(`${input.name}-${randomUUID().slice(0, 8)}`);
    const packageRoot = path.join(this.storagePaths.customPetsDir, packageId);
    let loadedIssues: ValidationIssue[];
    try {
      await mkdir(packageRoot, { recursive: true });
      const colorPalette = normalizePalette(input.preferredColors);
      const petPackage = createHatchPackage(input, packageId, colorPalette);
      await writeJsonAtomic(path.join(packageRoot, "pet.json"), petPackage);
      await writeFile(
        path.join(packageRoot, "spritesheet.svg"),
        createHatchSpriteSheet(input, colorPalette),
        "utf8"
      );
      await writeFile(
        path.join(packageRoot, "preview.svg"),
        createHatchPreview(input, colorPalette, 192),
        "utf8"
      );
      await writeFile(
        path.join(packageRoot, "icon.svg"),
        createHatchPreview(input, colorPalette, 96),
        "utf8"
      );

      const loadedPackage = await loadPetPackage(packageRoot, PetSource.Custom);
      loadedIssues = loadedPackage.issues;
      if (loadedPackage.petPackage === undefined || hasBlockingIssues(loadedPackage.issues)) {
        await rm(packageRoot, { recursive: true, force: true });
        return {
          packageId,
          installed: false,
          issues: loadedPackage.issues
        };
      }
    } catch (error) {
      await rm(packageRoot, { recursive: true, force: true });
      throw error;
    }

    await this.reloadPackages();
    await this.switchPet(packageId);
    return {
      packageId,
      installed: true,
      issues: loadedIssues
    };
  }

  /**
   * Export an installed custom pet package to a shareable archive.
   *
   * @param packageId - Custom package identifier to export.
   * @returns Archive path, or undefined when the package cannot be exported.
   */
  async exportPet(packageId: string): Promise<string | undefined> {
    const loadedPackage = this.loadedPackages.find(
      (candidate) => candidate.petPackage.packageId === packageId
    );
    if (loadedPackage === undefined || loadedPackage.petPackage.source !== PetSource.Custom) {
      return undefined;
    }

    await mkdir(this.storagePaths.exportsDir, { recursive: true });
    const outputPath = path.join(
      this.storagePaths.exportsDir,
      `${loadedPackage.petPackage.packageId}.deskagotchi-pet`
    );
    const archive = new AdmZip();
    archive.addLocalFolder(loadedPackage.packageRoot);
    archive.writeZip(outputPath);
    return outputPath;
  }

  /**
   * Prompt for and import a custom pet archive.
   *
   * @returns Current snapshot when canceled, or a refreshed snapshot after import.
   * @throws Error when the selected archive violates package safety rules.
   */
  async importPet(): Promise<DeskagotchiSnapshot> {
    const selection = await dialog.showOpenDialog({
      title: "Import Deskagotchi Pet Pack",
      properties: ["openFile"],
      filters: [{ name: "Deskagotchi Pet", extensions: ["deskagotchi-pet", "zip"] }]
    });
    if (selection.canceled || selection.filePaths[0] === undefined) {
      return this.createSnapshot();
    }

    await this.importPetPack(selection.filePaths[0]);
    await this.reloadPackages();
    return this.createSnapshot();
  }

  private async importPetPack(filePath: string): Promise<void> {
    const archiveStat = await stat(filePath);
    if (archiveStat.size > MAX_IMPORTED_PACKAGE_BYTES) {
      throw new Error("Imported pet pack exceeds the package size limit.");
    }

    const archive = new AdmZip(filePath);
    const packageId = slugify(path.basename(filePath, path.extname(filePath)));
    const destination = path.join(
      this.storagePaths.customPetsDir,
      `${packageId}-${randomUUID().slice(0, 8)}`
    );
    await mkdir(destination, { recursive: true });

    try {
      let entryCount = 0;
      let cumulativeUncompressedBytes = 0;

      for (const entry of archive.getEntries()) {
        entryCount += 1;
        if (entryCount > MAX_IMPORTED_PACKAGE_ENTRIES) {
          throw new Error("Imported pet pack contains too many entries.");
        }

        if (entry.isDirectory) {
          continue;
        }

        const normalizedEntryName = entry.entryName.replaceAll("\\", "/");
        if (
          normalizedEntryName.startsWith("/") ||
          normalizedEntryName.split("/").includes("..")
        ) {
          throw new Error(`Unsafe archive path '${entry.entryName}'.`);
        }
        if (entry.header.size > MAX_IMPORTED_PACKAGE_BYTES) {
          throw new Error(`Archive entry '${entry.entryName}' is too large.`);
        }
        cumulativeUncompressedBytes += entry.header.size;
        if (cumulativeUncompressedBytes > MAX_IMPORTED_PACKAGE_BYTES) {
          throw new Error("Imported pet pack exceeds the uncompressed size limit.");
        }

        const extension = path.extname(normalizedEntryName).toLowerCase();
        if ([".exe", ".cmd", ".bat", ".ps1", ".sh", ".js", ".mjs"].includes(extension)) {
          throw new Error(`Archive entry '${entry.entryName}' is executable.`);
        }

        const data = entry.getData();
        if (data.byteLength > MAX_IMPORTED_PACKAGE_BYTES) {
          throw new Error(`Archive entry '${entry.entryName}' is too large.`);
        }
        const actualUncompressedBytes =
          cumulativeUncompressedBytes - entry.header.size + data.byteLength;
        if (actualUncompressedBytes > MAX_IMPORTED_PACKAGE_BYTES) {
          throw new Error("Imported pet pack exceeds the uncompressed size limit.");
        }
        cumulativeUncompressedBytes = actualUncompressedBytes;

        const targetPath = path.join(destination, normalizedEntryName);
        await mkdir(path.dirname(targetPath), { recursive: true });
        await writeFile(targetPath, data);
      }

      const loadedPackage = await loadPetPackage(destination, PetSource.Custom);
      if (loadedPackage.petPackage === undefined || hasBlockingIssues(loadedPackage.issues)) {
        throw new Error("Imported pet pack failed validation.");
      }
      if (this.hasLoadedPackageId(loadedPackage.petPackage.packageId)) {
        throw new Error(
          `Imported pet pack uses existing package id '${loadedPackage.petPackage.packageId}'.`
        );
      }
    } catch (error) {
      await rm(destination, { recursive: true, force: true });
      throw error;
    }
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

  private resolveCareItem(
    request: CareActionRequest
  ): ItemCatalogEntry | undefined {
    if (request.itemId === undefined) {
      return undefined;
    }

    const itemManifest = this.requireItemManifest();
    const item = itemManifest.items.find(
      (candidate) => candidate.id === request.itemId
    );
    if (item === undefined) {
      throw new Error(`Unknown care item '${request.itemId}'.`);
    }

    if (request.type === CareActionType.FeedMeal && item.category !== ItemCategory.Meal) {
      throw new Error(`Care item '${item.id}' is not a meal.`);
    }
    if (
      request.type === CareActionType.FeedSnack &&
      item.category !== ItemCategory.Snack
    ) {
      throw new Error(`Care item '${item.id}' is not a snack.`);
    }

    return item;
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

  private hasLoadedPackageId(packageId: string): boolean {
    return this.loadedPackages.some(
      (loadedPackage) => loadedPackage.petPackage.packageId === packageId
    );
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
    await writeDeskagotchiSave(this.storagePaths, parsed);
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

/**
 * Build the placeholder pet manifest used before generated art is approved.
 *
 * @param input - Hatch prompt details from the renderer.
 * @param packageId - Generated package identifier.
 * @param colorPalette - Normalized package color palette.
 * @returns Pet package manifest for the local draft.
 */
function createHatchPackage(
  input: HatchDraftInput,
  packageId: string,
  colorPalette: string[]
): PetPackage {
  return {
    schemaVersion: 1,
    packageId,
    packageVersion: "0.1.0",
    minAppVersion: "0.1.0",
    name: input.name.trim(),
    description: `${input.description.trim()} ${IMAGEGEN_PLACEHOLDER_NOTE}`.trim(),
    source: PetSource.Custom,
    species: input.species.trim(),
    personality: input.personality.trim(),
    createdAt: new Date().toISOString(),
    assetVersion: "0.1.0",
    assets: {
      spritesheet: "spritesheet.svg",
      preview: "preview.svg",
      icon: "icon.svg"
    },
    animations: [
      animation(AnimationId.Idle, 0, 6),
      animation(AnimationId.Happy, 1, 8),
      animation(AnimationId.Walking, 2, 7),
      animation(AnimationId.Sleeping, 3, 2),
      animation(AnimationId.Sick, 4, 4)
    ],
    growthStages: [
      growthStage("egg", LifeStage.Egg, "Egg", stageThreshold(LifeStage.Egg)),
      growthStage("baby", LifeStage.Baby, "Baby", stageThreshold(LifeStage.Baby)),
      growthStage("child", LifeStage.Child, "Child", stageThreshold(LifeStage.Child)),
      growthStage("teen", LifeStage.Teen, "Teen", stageThreshold(LifeStage.Teen)),
      growthStage("adult", LifeStage.Adult, "Adult", stageThreshold(LifeStage.Adult))
    ],
    preferredFoods: ["custom treat"],
    dislikedFoods: ["burnt snack"],
    foodPreferences: {
      sharedFoodIds: ["meal-rice-ball", "meal-steamed-bun", "snack-biscuit"],
      likedFoodIds: ["snack-apple-slice"],
      favoriteFoodIds: ["meal-banana"],
      dislikedFoodIds: ["snack-candy"],
      eatingAnchor: { x: 0.58, y: 0.58, size: 22 }
    },
    favoritePlayStyle: PlayStyle.Calm,
    careModifiers: {
      hungerDecayMultiplier: 1,
      happinessDecayMultiplier: 1,
      energyDecayMultiplier: 1,
      cleanlinessDecayMultiplier: 1,
      affectionGainMultiplier: 1
    },
    colorPalette,
    author: "Local user",
    license: "Local custom Deskagotchi pet",
    capabilities: ["hatch-mvp", "placeholder-art"],
    validationStatus: PackageValidationStatus.Passed,
    assetHash: `${packageId}-local-placeholder`,
    generation: {
      mode: "local-placeholder",
      prompt: JSON.stringify(input),
      referenceImageStored: false
    }
  };
}

function animation(id: AnimationId, row: number, fps: number): PetPackage["animations"][number] {
  return {
    id,
    row,
    frames: 4,
    frameWidth: 96,
    frameHeight: 96,
    fps,
    loop: true,
    ...(id === AnimationId.Idle ? {} : { fallback: AnimationId.Idle })
  };
}

function stageThreshold(lifeStage: LifeStage): number {
  return DEFAULT_SIMULATION_CONFIG.stageThresholdHours[lifeStage];
}

function growthStage(
  id: string,
  lifeStage: LifeStage,
  label: string,
  minAgeHours: number
): PetPackage["growthStages"][number] {
  return {
    id,
    stage: lifeStage,
    label,
    minAgeHours,
    careScoreMin: 0,
    careScoreMax: 100,
    animationSet: [...HATCH_PLACEHOLDER_ANIMATION_IDS]
  };
}

/**
 * Render a deterministic SVG spritesheet for a local hatch draft.
 *
 * @param input - Hatch prompt details from the renderer.
 * @param palette - Normalized color palette.
 * @returns Complete SVG document for the placeholder spritesheet.
 */
function createHatchSpriteSheet(input: HatchDraftInput, palette: string[]): string {
  const frames = HATCH_PLACEHOLDER_ANIMATION_IDS.flatMap((animationId, rowIndex) =>
    [0, 1, 2, 3].map(
      (frame) =>
        `<g transform="translate(${frame * 96} ${rowIndex * 96})">${hatchPetMarkup(input, palette, animationId, frame)}</g>`
    )
  );
  const height = HATCH_PLACEHOLDER_ANIMATION_IDS.length * 96;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="${height}" viewBox="0 0 384 ${height}">${frames.join("")}</svg>\n`;
}

function createHatchPreview(
  input: HatchDraftInput,
  palette: string[],
  size: number
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">${hatchPetMarkup(input, palette, AnimationId.Happy, 1)}</svg>\n`;
}

function hatchPetMarkup(
  input: HatchDraftInput,
  palette: string[],
  animationId: AnimationId,
  frame: number
): string {
  const [primary, secondary, outline, highlight] = palette;
  const bob = Math.sin(frame * Math.PI * 0.5) * 2;
  const sleepy = animationId === AnimationId.Sleeping;
  const sick = animationId === AnimationId.Sick;
  const happy = animationId === AnimationId.Happy;
  const accessory = input.accessory
    ? `<path d="M64 25 L77 15 L73 31 Z" fill="${highlight}" stroke="${outline}" stroke-width="3"/>`
    : "";
  const eyes = sleepy
    ? `<path d="M33 43 Q39 39 45 43" fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round"/><path d="M53 43 Q59 39 65 43" fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round"/>`
    : `<circle cx="39" cy="43" r="3.4" fill="${outline}"/><circle cx="59" cy="43" r="3.4" fill="${outline}"/>`;
  const mouth = happy
    ? `<path d="M39 58 Q49 67 59 58" fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round"/>`
    : `<path d="M43 60 Q49 57 55 60" fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round"/>`;
  const patch = sick
    ? `<rect x="31" y="25" width="36" height="9" rx="4.5" fill="${highlight}" stroke="${outline}" stroke-width="2"/>`
    : "";

  return `<g transform="translate(0 ${bob})"><path d="M22 56 C21 35 36 24 50 30 C63 22 78 36 75 58 C72 78 58 81 49 75 C38 82 24 76 22 56 Z" fill="${primary}" stroke="${outline}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="49" cy="57" rx="18" ry="12" fill="${secondary}" opacity="0.32"/><circle cx="49" cy="50" r="31" fill="none" stroke="${outline}" stroke-width="1.5" opacity="0.15"/>${eyes}${mouth}${accessory}${patch}<circle cx="29" cy="53" r="3" fill="${secondary}" opacity="0.55"/><circle cx="69" cy="53" r="3" fill="${secondary}" opacity="0.55"/></g>`;
}

function normalizePalette(colors: string[]): string[] {
  const validColors = colors.filter((color) => /^#[0-9a-fA-F]{6}$/.test(color));
  const palette = validColors.length >= 2 ? validColors : ["#9bdbd4", "#4ecdc4"];
  return [
    palette[0] ?? "#9bdbd4",
    palette[1] ?? "#4ecdc4",
    "#243447",
    palette[2] ?? "#fff4d6"
  ];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}
