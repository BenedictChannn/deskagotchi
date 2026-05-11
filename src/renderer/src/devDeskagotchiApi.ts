import {
  AnimationId,
  PetSource,
  DeskagotchiSaveSchema,
  PetPackageSchema,
  type DeskagotchiSave,
  type PetInstanceState,
  type PetPackage,
  type ValidationIssue
} from "@shared/domain";
import {
  createHatchPetPackage,
  type HatchDraftInput,
  validateHatchDraftInput
} from "@shared/hatch";
import {
  type CareActionRequest,
  type DeskagotchiApi,
  type DeskagotchiSnapshot,
  type RuntimePetPackage,
  type UpdateSettingsInput
} from "@shared/ipc";
import {
  applyCareAction,
  createInitialPetState,
  DEFAULT_SIMULATION_CONFIG
} from "@shared/simulation";
import { ItemIconManifestSchema } from "@shared/itemIcons";

import baoIconUrl from "../../../resources/pets/bao/icon.png?url";
import baoManifest from "../../../resources/pets/bao/pet.json";
import baoPreviewUrl from "../../../resources/pets/bao/preview.png?url";
import baoSpritesheetUrl from "../../../resources/pets/bao/spritesheet.png?url";
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
const CUSTOM_PACKAGES_STORAGE_KEY = "deskagotchi.dev.customPackages.v1";
const SNAPSHOT_EVENT = "deskagotchi-dev-snapshot";
const ITEM_MANIFEST = ItemIconManifestSchema.parse(itemManifestData);

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
      hatchCreateDraft: async (input) => this.hatchCreateDraft(input),
      exportPet: async () => undefined,
      importPet: async () => this.createSnapshot(),
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
    const item = request.itemId === undefined
      ? undefined
      : ITEM_MANIFEST.items.find((candidate) => candidate.id === request.itemId);
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
   * Create and install a local custom pet draft for browser testing.
   *
   * @param input - Hatch form values from the panel.
   * @returns Installation result and validation issues for the draft.
   */
  private async hatchCreateDraft(
    input: HatchDraftInput
  ): Promise<{ packageId: string; installed: boolean; issues: ValidationIssue[] }> {
    const issues = validateHatchDraftInput(input);
    if (issues.length > 0) {
      return {
        packageId: "",
        installed: false,
        issues
      };
    }

    const packageId = slugify(`${input.name}-${Date.now().toString(36)}`);
    const petPackage = createHatchPetPackage({
      input,
      packageId,
      colorPalette: normalizeColors(input.preferredColors),
      stageThresholdHours: DEFAULT_SIMULATION_CONFIG.stageThresholdHours,
      createdAt: new Date().toISOString(),
      assetHash: `${packageId}-browser-dev`,
      author: "Local user",
      license: "Local custom Deskagotchi pet"
    });
    this.packages = [...this.packages, toRuntimePackage(petPackage)];
    this.persistCustomPackages();
    await this.switchPet(packageId);

    return {
      packageId,
      installed: true,
      issues: []
    };
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

  /**
   * Persist generated custom packages so browser reloads can resolve active saves.
   */
  private persistCustomPackages(): void {
    persistCustomDevPackages(this.packages);
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
 * @param packages - Runtime packages available after loading persisted custom manifests.
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
 * @returns Runtime packages with generated PNG and SVG assets.
 */
function createDevPackages(): RuntimePetPackage[] {
  const builtInPackages = [
    createBaoRuntimePackage(),
    createMisoRuntimePackage(),
    createMochiRuntimePackage(),
    createPeanutRuntimePackage(),
    createPuddlesRuntimePackage()
  ];

  return [...builtInPackages, ...loadCustomDevPackages().map(toRuntimePackage)];
}

/**
 * Attach Bao's imagegen-assisted shih tzu package to the browser adapter.
 *
 * @returns Runtime package using the same PNG files that Electron serves.
 */
function createBaoRuntimePackage(): RuntimePetPackage {
  return {
    petPackage: PetPackageSchema.parse(baoManifest),
    assetUrls: {
      spritesheet: baoSpritesheetUrl,
      preview: baoPreviewUrl,
      icon: baoIconUrl
    },
    issues: []
  };
}

/**
 * Attach Miso's imagegen-assisted cat package to the browser adapter.
 *
 * @returns Runtime package using the same PNG files that Electron serves.
 */
function createMisoRuntimePackage(): RuntimePetPackage {
  return {
    petPackage: PetPackageSchema.parse(misoManifest),
    assetUrls: {
      spritesheet: misoSpritesheetUrl,
      preview: misoPreviewUrl,
      icon: misoIconUrl
    },
    issues: []
  };
}

/**
 * Attach Mochi's imagegen-assisted monkey package to the browser adapter.
 *
 * @returns Runtime package using the same PNG files that Electron serves.
 */
function createMochiRuntimePackage(): RuntimePetPackage {
  return {
    petPackage: PetPackageSchema.parse(mochiManifest),
    assetUrls: {
      spritesheet: mochiSpritesheetUrl,
      preview: mochiPreviewUrl,
      icon: mochiIconUrl
    },
    issues: []
  };
}

/**
 * Attach Peanut's imagegen-assisted elephant package to the browser adapter.
 *
 * @returns Runtime package using the same PNG files that Electron serves.
 */
function createPeanutRuntimePackage(): RuntimePetPackage {
  return {
    petPackage: PetPackageSchema.parse(peanutManifest),
    assetUrls: {
      spritesheet: peanutSpritesheetUrl,
      preview: peanutPreviewUrl,
      icon: peanutIconUrl
    },
    issues: []
  };
}

/**
 * Attach Puddles' duck package to the browser adapter.
 *
 * @returns Runtime package using the same PNG files that Electron serves.
 */
function createPuddlesRuntimePackage(): RuntimePetPackage {
  return {
    petPackage: PetPackageSchema.parse(puddlesManifest),
    assetUrls: {
      spritesheet: puddlesSpritesheetUrl,
      preview: puddlesPreviewUrl,
      icon: puddlesIconUrl
    },
    issues: []
  };
}

/**
 * Load generated custom package manifests from browser storage.
 *
 * @returns Schema-valid custom pet packages created by the development hatch flow.
 */
function loadCustomDevPackages(): PetPackage[] {
  const stored = window.localStorage.getItem(CUSTOM_PACKAGES_STORAGE_KEY);
  if (stored === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(CUSTOM_PACKAGES_STORAGE_KEY);
      return [];
    }

    return parsed.flatMap((candidate) => {
      const parsedPackage = PetPackageSchema.safeParse(candidate);
      if (!parsedPackage.success || parsedPackage.data.source !== PetSource.Custom) {
        return [];
      }
      return [parsedPackage.data];
    });
  } catch {
    window.localStorage.removeItem(CUSTOM_PACKAGES_STORAGE_KEY);
    return [];
  }
}

/**
 * Persist generated custom package manifests for browser development reloads.
 *
 * @param packages - Current runtime package registry.
 */
function persistCustomDevPackages(packages: RuntimePetPackage[]): void {
  const customPackages = packages
    .map((runtimePackage) => runtimePackage.petPackage)
    .filter((petPackage) => petPackage.source === PetSource.Custom);

  if (customPackages.length === 0) {
    window.localStorage.removeItem(CUSTOM_PACKAGES_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    CUSTOM_PACKAGES_STORAGE_KEY,
    JSON.stringify(customPackages)
  );
}

/**
 * Attach generated browser asset URLs to a pet package.
 *
 * @param petPackage - Package manifest to convert.
 * @returns Runtime package with spritesheet, preview, and icon data URLs.
 */
function toRuntimePackage(petPackage: PetPackage): RuntimePetPackage {
  const [primary, secondary, outline, highlight] = normalizeColors(petPackage.colorPalette);
  const preview = createPetSvgDataUrl(primary, secondary, outline, highlight, AnimationId.Happy, 1);
  return {
    petPackage,
    assetUrls: {
      spritesheet: createSpritesheetDataUrl(petPackage.colorPalette),
      preview,
      icon: preview
    },
    issues: []
  };
}

/**
 * Generate a data URL spritesheet for all supported animation rows.
 *
 * @param colors - Preferred package colors used to render the placeholder pet.
 * @returns Encoded SVG data URL for the development spritesheet.
 */
function createSpritesheetDataUrl(colors: string[]): string {
  const [primary, secondary, outline, highlight] = normalizeColors(colors);
  const rows = Object.values(AnimationId).flatMap((animationId, rowIndex) =>
    [0, 1, 2, 3].map(
      (frame) =>
        `<g transform="translate(${frame * 96} ${rowIndex * 96})">${createPetMarkup(
          primary,
          secondary,
          outline,
          highlight,
          animationId,
          frame
        )}</g>`
    )
  );
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="1056" viewBox="0 0 384 1056">${rows.join("")}</svg>`
  );
}

/**
 * Generate a single-frame preview or icon data URL.
 *
 * @param primary - Primary body color.
 * @param secondary - Secondary accent color.
 * @param outline - Outline and facial feature color.
 * @param highlight - Highlight and accessory color.
 * @param animationId - Animation expression to render.
 * @param frame - Frame index used for simple motion offsets.
 * @returns Encoded SVG data URL for the preview frame.
 */
function createPetSvgDataUrl(
  primary: string,
  secondary: string,
  outline: string,
  highlight: string,
  animationId: AnimationId,
  frame: number
): string {
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 96 96">${createPetMarkup(
      primary,
      secondary,
      outline,
      highlight,
      animationId,
      frame
    )}</svg>`
  );
}

/**
 * Generate reusable SVG markup for a placeholder pet frame.
 *
 * @param primary - Primary body color.
 * @param secondary - Secondary accent color.
 * @param outline - Outline and facial feature color.
 * @param highlight - Highlight and accessory color.
 * @param animationId - Animation expression to render.
 * @param frame - Frame index used for simple motion offsets.
 * @returns SVG fragment inserted into spritesheets and previews.
 */
function createPetMarkup(
  primary: string,
  secondary: string,
  outline: string,
  highlight: string,
  animationId: AnimationId,
  frame: number
): string {
  const bob = Math.sin(frame * Math.PI * 0.5) * 2;
  const sleeping = animationId === AnimationId.Sleeping;
  const sick = animationId === AnimationId.Sick;
  const happy =
    animationId === AnimationId.Happy ||
    animationId === AnimationId.Eating ||
    animationId === AnimationId.Playing;
  const hungry = animationId === AnimationId.Hungry;
  const attention = animationId === AnimationId.Attention;
  const eyes = sleeping
    ? `<path d="M33 43 Q39 39 45 43" fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round"/><path d="M53 43 Q59 39 65 43" fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round"/>`
    : `<circle cx="39" cy="43" r="3.4" fill="${outline}"/><circle cx="59" cy="43" r="3.4" fill="${outline}"/>`;
  const mouth = happy
    ? `<path d="M39 58 Q49 67 59 58" fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round"/>`
    : hungry
      ? `<circle cx="49" cy="59" r="4" fill="none" stroke="${outline}" stroke-width="3"/>`
      : `<path d="M43 61 Q49 57 55 61" fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round"/>`;
  const patch = sick
    ? `<rect x="31" y="25" width="36" height="9" rx="4.5" fill="${highlight}" stroke="${outline}" stroke-width="2"/>`
    : "";
  const call = attention
    ? `<circle cx="74" cy="26" r="4" fill="${highlight}" stroke="${outline}" stroke-width="2"/>`
    : "";

  return `<g transform="translate(0 ${bob})"><path d="M22 56 C21 35 36 24 50 30 C63 22 78 36 75 58 C72 78 58 81 49 75 C38 82 24 76 22 56 Z" fill="${primary}" stroke="${outline}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="49" cy="57" rx="18" ry="12" fill="${secondary}" opacity="0.32"/>${eyes}${mouth}${patch}${call}<circle cx="29" cy="53" r="3" fill="${secondary}" opacity="0.55"/><circle cx="69" cy="53" r="3" fill="${secondary}" opacity="0.55"/></g>`;
}

/**
 * Normalize a preferred color list into the four-color placeholder palette.
 *
 * @param colors - User or package-provided hex colors.
 * @returns Primary, secondary, outline, and highlight colors.
 */
function normalizeColors(colors: string[]): string[] {
  const validColors = colors.filter((color) => /^#[0-9a-fA-F]{6}$/.test(color));
  const palette = validColors.length >= 2 ? validColors : ["#9bdbd4", "#4ecdc4"];
  return [
    palette[0] ?? "#9bdbd4",
    palette[1] ?? "#4ecdc4",
    "#243447",
    palette[2] ?? "#fff4d6"
  ];
}

/**
 * Convert free-form package names into compact package ids.
 *
 * @param value - Raw value to normalize.
 * @returns Lowercase slug capped to the package id length used by the adapter.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

/**
 * Encode SVG text for use in image URLs.
 *
 * @param svg - Raw SVG document string.
 * @returns Data URL suitable for img and CSS background usage.
 */
function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
