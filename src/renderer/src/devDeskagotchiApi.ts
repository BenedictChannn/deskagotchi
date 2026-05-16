import {
  DeskagotchiSaveSchema,
  PetPackageSchema,
  type DeskagotchiSave,
  type PetInstanceState,
} from "@shared/domain";
import {
  type CareActionRequest,
  type DeskagotchiApi,
  type DeskagotchiSnapshot,
  type RuntimePetPackage,
  type UpdateSettingsInput
} from "@shared/ipc";
import { resolveCareItem } from "@shared/careItems";
import {
  applyCareAction,
  createInitialPetState
} from "@shared/simulation";
import { ItemIconManifestSchema } from "@shared/itemIcons";

import baoIconUrl from "../../../resources/pets/bao/icon.png?url";
import baoManifest from "../../../resources/pets/bao/pet.json";
import baoPreviewUrl from "../../../resources/pets/bao/preview.png?url";
import baoSpritesheetUrl from "../../../resources/pets/bao/spritesheet.png?url";
import builtInRoster from "../../../resources/pets/built-in-roster.json";
import itemManifestData from "../../../resources/items/lcd-core/items.json";
import misoIconUrl from "../../../resources/pets/miso/icon.png?url";
import misoManifest from "../../../resources/pets/miso/pet.json";
import misoPreviewUrl from "../../../resources/pets/miso/preview.png?url";
import misoSpritesheetUrl from "../../../resources/pets/miso/spritesheet.png?url";
import mochiIconUrl from "../../../resources/pets/mochi/icon.png?url";
import mochiManifest from "../../../resources/pets/mochi/pet.json";
import mochiPreviewUrl from "../../../resources/pets/mochi/preview.png?url";
import mochiSpritesheetUrl from "../../../resources/pets/mochi/spritesheet.png?url";
import peanutIconUrl from "../../../resources/pets/peanut/icon.png?url";
import peanutManifest from "../../../resources/pets/peanut/pet.json";
import peanutPreviewUrl from "../../../resources/pets/peanut/preview.png?url";
import peanutSpritesheetUrl from "../../../resources/pets/peanut/spritesheet.png?url";
import puddlesIconUrl from "../../../resources/pets/puddles/icon.png?url";
import puddlesManifest from "../../../resources/pets/puddles/pet.json";
import puddlesPreviewUrl from "../../../resources/pets/puddles/preview.png?url";
import puddlesSpritesheetUrl from "../../../resources/pets/puddles/spritesheet.png?url";
import { shouldInstallDevDeskagotchiApi } from "./devBridgeGate";

const STORAGE_KEY = "deskagotchi.dev.save.v2";
const SNAPSHOT_EVENT = "deskagotchi-dev-snapshot";
const ITEM_MANIFEST = ItemIconManifestSchema.parse(itemManifestData);
const BUILT_IN_PACKAGE_ASSETS = {
  bao: {
    manifest: baoManifest,
    spritesheet: baoSpritesheetUrl,
    preview: baoPreviewUrl,
    icon: baoIconUrl
  },
  miso: {
    manifest: misoManifest,
    spritesheet: misoSpritesheetUrl,
    preview: misoPreviewUrl,
    icon: misoIconUrl
  },
  mochi: {
    manifest: mochiManifest,
    spritesheet: mochiSpritesheetUrl,
    preview: mochiPreviewUrl,
    icon: mochiIconUrl
  },
  peanut: {
    manifest: peanutManifest,
    spritesheet: peanutSpritesheetUrl,
    preview: peanutPreviewUrl,
    icon: peanutIconUrl
  },
  puddles: {
    manifest: puddlesManifest,
    spritesheet: puddlesSpritesheetUrl,
    preview: puddlesPreviewUrl,
    icon: puddlesIconUrl
  }
} as const;

/**
 * Install a browser-only Deskagotchi bridge for Vite development.
 */
export function installDevDeskagotchiApi(): void {
  if (
    !shouldInstallDevDeskagotchiApi(
      window.location.hostname,
      window.deskagotchi !== undefined,
      window.navigator.userAgent
    )
  ) {
    return;
  }

  const api = new DevDeskagotchiApi();
  window.deskagotchi = api.toBridgeApi();
}

/**
 * Browser implementation of the Electron preload bridge.
 *
 * @remarks This adapter keeps local development usable without Electron by persisting a
 * simulated save to localStorage and dispatching DOM events for snapshot updates.
 */
class DevDeskagotchiApi {
  private packages = createDevPackages();
  private save = loadDevSave(this.packages);

  /**
   * Create the public bridge shape expected by renderer components.
   *
   * @returns A Deskagotchi bridge API backed by browser storage and events.
   */
  toBridgeApi(): DeskagotchiApi {
    return {
      getSnapshot: async () => this.createSnapshot(),
      performAction: async (request) => this.performAction(request),
      switchPet: async (packageId) => this.switchPet(packageId),
      updateSettings: async (settings) => this.updateSettings(settings),
      openPanel: async (view) => {
        window.location.hash = `#/panel/${view}`;
      },
      hidePanel: async () => undefined,
      resetPetWindow: async () => undefined,
      movePetWindow: async () => undefined,
      finishPetWindowDrag: async () => undefined,
      setPetWindowUiMode: async () => undefined,
      enterPetWindowPlayMode: async () => undefined,
      exitPetWindowPlayMode: async () => undefined,
      setClickThrough: async () => undefined,
      recordQaEvent: async () => undefined,
      onSnapshotUpdated: (callback) => {
        const listener = (): void => callback();
        window.addEventListener(SNAPSHOT_EVENT, listener);
        return () => window.removeEventListener(SNAPSHOT_EVENT, listener);
      }
    };
  }

  /**
   * Apply a care action to the active pet and broadcast the resulting snapshot.
   *
   * @param request - Care action selected by the renderer.
   * @returns The updated snapshot after simulation and persistence.
   * @throws Error when the active pet state or package cannot be found.
   */
  private async performAction(
    request: CareActionRequest
  ): Promise<DeskagotchiSnapshot> {
    const activeState = this.getActiveState();
    const activePackage = this.getRuntimePackage(activeState.packageId);
    const item = resolveCareItem(request, ITEM_MANIFEST);
    const next = applyCareAction(activeState, activePackage.petPackage, {
      type: request.type,
      now: new Date(),
      item
    });
    this.replaceInstance(next.state);
    return this.persistAndSnapshot();
  }

  /**
   * Select an installed pet package, creating a first instance when needed.
   *
   * @param packageId - Package identifier selected in the panel.
   * @returns The updated snapshot with the package active.
   * @throws Error when the package is unknown.
   */
  private async switchPet(packageId: string): Promise<DeskagotchiSnapshot> {
    const selectedPackage = this.getRuntimePackage(packageId);
    const existingInstance = this.save.instances.find(
      (instance) => instance.packageId === packageId
    );
    const instance =
      existingInstance ??
      createInitialPetState(selectedPackage.petPackage, selectedPackage.petPackage.name, new Date());

    this.save = {
      ...this.save,
      activeInstanceId: instance.instanceId,
      instances: existingInstance ? this.save.instances : [...this.save.instances, instance]
    };

    return this.persistAndSnapshot();
  }

  /**
   * Merge partial settings into the browser save.
   *
   * @param settings - Partial settings payload from the renderer.
   * @returns The updated snapshot after persistence.
   */
  private async updateSettings(
    settings: UpdateSettingsInput
  ): Promise<DeskagotchiSnapshot> {
    this.save = {
      ...this.save,
      settings: {
        ...this.save.settings,
        ...settings
      }
    };
    return this.persistAndSnapshot();
  }

  /**
   * Build a snapshot matching the Electron runtime contract.
   *
   * @returns The current browser-backed Deskagotchi snapshot.
   * @throws Error when the active pet state or package cannot be found.
   */
  private createSnapshot(): DeskagotchiSnapshot {
    const activeState = this.getActiveState();
    const activePackage = this.getRuntimePackage(activeState.packageId);
    return {
      save: this.save,
      activeState,
      activePackage,
      packages: this.packages,
      appVersion: "0.1.0-dev-browser",
      userDataPath: "browser localStorage"
    };
  }

  /**
   * Persist the save and notify renderer subscribers.
   *
   * @returns The snapshot after writing localStorage and dispatching the update event.
   */
  private persistAndSnapshot(): DeskagotchiSnapshot {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save));
    window.dispatchEvent(new Event(SNAPSHOT_EVENT));
    return this.createSnapshot();
  }

  /**
   * Resolve the active pet instance from the save.
   *
   * @returns The active pet instance state.
   * @throws Error when the save points at a missing instance.
   */
  private getActiveState(): PetInstanceState {
    const activeState = this.save.instances.find(
      (instance) => instance.instanceId === this.save.activeInstanceId
    );
    if (activeState === undefined) {
      throw new Error("Dev Deskagotchi active state is missing.");
    }
    return activeState;
  }

  /**
   * Resolve a runtime package by package id.
   *
   * @param packageId - Package identifier to look up.
   * @returns The matching runtime pet package.
   * @throws Error when no package exists for the id.
   */
  private getRuntimePackage(packageId: string): RuntimePetPackage {
    const petPackage = this.packages.find(
      (candidate) => candidate.petPackage.packageId === packageId
    );
    if (petPackage === undefined) {
      throw new Error(`Unknown dev Deskagotchi package '${packageId}'.`);
    }
    return petPackage;
  }

  /**
   * Replace an existing pet instance in the browser save.
   *
   * @param instance - Updated pet state to store by instance id.
   */
  private replaceInstance(instance: PetInstanceState): void {
    this.save = {
      ...this.save,
      instances: this.save.instances.map((candidate) =>
        candidate.instanceId === instance.instanceId ? instance : candidate
      )
    };
  }

}

/**
 * Load a compatible browser save or create a new seed save.
 *
 * @param packages - Runtime packages available in the development adapter.
 * @returns A save that references at least one available package.
 */
function loadDevSave(packages: RuntimePetPackage[]): DeskagotchiSave {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    try {
      const parsed = DeskagotchiSaveSchema.safeParse(JSON.parse(stored));
      if (parsed.success) {
        const repairedSave = repairDevSave(parsed.data, packages);
        if (repairedSave !== undefined) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(repairedSave));
          return repairedSave;
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  const initialPackage = packages[0].petPackage;
  const initialState = createInitialPetState(initialPackage, initialPackage.name, new Date());
  return {
    schemaVersion: 1,
    activeInstanceId: initialState.instanceId,
    instances: [initialState],
    settings: {
      alwaysOnTop: true,
      launchOnStartup: false,
      soundEnabled: false,
      reducedMotion: false,
      lowMaintenanceMode: false,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      notificationsEnabled: true,
      notificationCooldownMinutes: 60,
      clickThroughWhenIdle: false
    }
  };
}

/**
 * Remove save instances that reference unavailable packages and repair active selection.
 *
 * @param save - Parsed browser development save.
 * @param packages - Built-in runtime packages available in the browser adapter.
 * @returns A repaired save, or undefined when no saved instance can be resolved.
 */
function repairDevSave(
  save: DeskagotchiSave,
  packages: RuntimePetPackage[]
): DeskagotchiSave | undefined {
  const packageIds = new Set(
    packages.map((petPackage) => petPackage.petPackage.packageId)
  );
  const availableInstances = save.instances.filter((instance) =>
    packageIds.has(instance.packageId)
  );
  if (availableInstances.length === 0) {
    return undefined;
  }

  const activeInstance = availableInstances.find(
    (instance) => instance.instanceId === save.activeInstanceId
  );

  return {
    ...save,
    activeInstanceId: activeInstance?.instanceId ?? availableInstances[0].instanceId,
    instances: availableInstances
  };
}

/**
 * Create the built-in packages used by the browser adapter.
 *
 * @returns Runtime packages backed by the same committed PNG assets as Electron.
 */
function createDevPackages(): RuntimePetPackage[] {
  return builtInDevPetIds().map((petId) => {
    const asset = BUILT_IN_PACKAGE_ASSETS[petId];
    return {
      petPackage: PetPackageSchema.parse(asset.manifest),
      assetUrls: {
        spritesheet: asset.spritesheet,
        preview: asset.preview,
        icon: asset.icon
      },
      issues: []
    };
  });
}

function builtInDevPetIds(): Array<keyof typeof BUILT_IN_PACKAGE_ASSETS> {
  const rosterIds = new Set(builtInRoster.petIds);
  const assetIds = new Set(Object.keys(BUILT_IN_PACKAGE_ASSETS));
  const missingAssets = builtInRoster.petIds.filter((petId) => !assetIds.has(petId));
  const staleAssets = [...assetIds].filter((petId) => !rosterIds.has(petId));
  if (missingAssets.length > 0 || staleAssets.length > 0) {
    throw new Error(
      [
        "Built-in pet roster and browser dev assets are out of sync.",
        missingAssets.length > 0 ? `Missing assets: ${missingAssets.join(", ")}` : "",
        staleAssets.length > 0 ? `Stale assets: ${staleAssets.join(", ")}` : ""
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
  return builtInRoster.petIds.map((petId) => {
    if (!isBuiltInAssetId(petId)) {
      throw new Error(`Built-in pet '${petId}' does not have browser dev assets.`);
    }
    return petId;
  });
}

function isBuiltInAssetId(
  petId: string
): petId is keyof typeof BUILT_IN_PACKAGE_ASSETS {
  return petId in BUILT_IN_PACKAGE_ASSETS;
}
