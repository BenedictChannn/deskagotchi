import {
  AnimationId,
  CareActionType,
  LifeStage,
  PackageValidationStatus,
  PetSource,
  PlayStyle,
  ValidationSeverity,
  type DeskagotchiSave,
  type PetInstanceState,
  type PetPackage,
  type ValidationIssue
} from "@shared/domain";
import {
  type DeskagotchiApi,
  type DeskagotchiSnapshot,
  type HatchDraftInput,
  type RuntimePetPackage,
  type UpdateSettingsInput
} from "@shared/ipc";
import { applyCareAction, createInitialPetState } from "@shared/simulation";

const STORAGE_KEY = "deskagotchi.dev.save.v1";
const SNAPSHOT_EVENT = "deskagotchi-dev-snapshot";
const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Install a browser-only Deskagotchi bridge for Vite development.
 */
export function installDevDeskagotchiApi(): void {
  if (window.deskagotchi !== undefined || !DEV_HOSTS.has(window.location.hostname)) {
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
      performAction: async (actionType) => this.performAction(actionType),
      switchPet: async (packageId) => this.switchPet(packageId),
      updateSettings: async (settings) => this.updateSettings(settings),
      openPanel: async (view) => {
        window.location.hash = `#/panel/${view}`;
      },
      hidePanel: async () => undefined,
      resetPetWindow: async () => undefined,
      setClickThrough: async () => undefined,
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
   * @param actionType - Care action selected by the renderer.
   * @returns The updated snapshot after simulation and persistence.
   * @throws Error when the active pet state or package cannot be found.
   */
  private async performAction(
    actionType: CareActionType
  ): Promise<DeskagotchiSnapshot> {
    const activeState = this.getActiveState();
    const activePackage = this.getRuntimePackage(activeState.packageId);
    const next = applyCareAction(activeState, activePackage.petPackage, {
      type: actionType,
      now: new Date()
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
    const issues = validateHatchInput(input);
    if (issues.length > 0) {
      return {
        packageId: "",
        installed: false,
        issues
      };
    }

    const packageId = slugify(`${input.name}-${Date.now().toString(36)}`);
    const petPackage = createDevPetPackage({
      packageId,
      name: input.name.trim(),
      description: input.description.trim() || "A locally hatched browser-test pet.",
      source: PetSource.Custom,
      species: input.species.trim() || "Custom companion",
      personality: input.personality.trim() || "Curious and steady.",
      colorPalette: normalizeColors(input.preferredColors)
    });
    this.packages = [...this.packages, toRuntimePackage(petPackage)];
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
      const parsed = JSON.parse(stored) as DeskagotchiSave;
      if (
        parsed.schemaVersion === 1 &&
        packages.some((petPackage) =>
          parsed.instances.some(
            (instance) => instance.packageId === petPackage.petPackage.packageId
          )
        )
      ) {
        return parsed;
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
 * Create the built-in placeholder packages used by the browser adapter.
 *
 * @returns Runtime packages with generated SVG assets.
 */
function createDevPackages(): RuntimePetPackage[] {
  return [
    createDevPetPackage({
      packageId: "deskcat",
      name: "Deskcat",
      description: "A tiny original cat-like desk companion.",
      species: "Cat-like desk companion",
      personality: "Curious, alert, and fond of small desk rituals.",
      colorPalette: ["#f7b267", "#f79d65", "#2f243a", "#fefae0"]
    }),
    createDevPetPackage({
      packageId: "deskduck",
      name: "Deskduck",
      description: "A compact duck-like companion with a bright little waddle.",
      species: "Duck-like desk companion",
      personality: "Cheerful, snack-motivated, and quick to call for attention.",
      colorPalette: ["#ffd166", "#f4a261", "#243447", "#fff4d6"]
    }),
    createDevPetPackage({
      packageId: "deskblob",
      name: "Deskblob",
      description: "A soft abstract companion built for calm desktop company.",
      species: "Abstract blob companion",
      personality: "Gentle, low-maintenance, and expressive.",
      colorPalette: ["#9bdbd4", "#4ecdc4", "#243447", "#fff4d6"]
    })
  ].map(toRuntimePackage);
}

/**
 * Create a package manifest for a generated development pet.
 *
 * @param overrides - Package identity, copy, palette, and optional source override.
 * @returns A package manifest compatible with runtime validation expectations.
 */
function createDevPetPackage(overrides: {
  packageId: string;
  name: string;
  description: string;
  species: string;
  personality: string;
  colorPalette: string[];
  source?: PetSource;
}): PetPackage {
  return {
    schemaVersion: 1,
    packageId: overrides.packageId,
    packageVersion: "0.1.0",
    minAppVersion: "0.1.0",
    name: overrides.name,
    description: overrides.description,
    source: overrides.source ?? PetSource.BuiltIn,
    species: overrides.species,
    personality: overrides.personality,
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
      animation(AnimationId.Sad, 2, 6),
      animation(AnimationId.Hungry, 3, 6),
      animation(AnimationId.Eating, 4, 6),
      animation(AnimationId.Playing, 5, 8),
      animation(AnimationId.Sleeping, 6, 2),
      animation(AnimationId.Sick, 7, 4),
      animation(AnimationId.Cleaning, 8, 6),
      animation(AnimationId.Walking, 9, 8),
      animation(AnimationId.Attention, 10, 6)
    ],
    growthStages: [
      growthStage("egg", LifeStage.Egg, "Egg", 0, 0, 100),
      growthStage("baby", LifeStage.Baby, `Baby ${overrides.name}`, 2, 0, 100),
      growthStage("child-calm", LifeStage.Child, "Calm Child", 8, 0, 59),
      growthStage("child-bright", LifeStage.Child, "Bright Child", 8, 60, 100),
      growthStage("teen-shy", LifeStage.Teen, "Shy Teen", 30, 0, 49),
      growthStage("teen-spry", LifeStage.Teen, "Spry Teen", 30, 50, 100),
      growthStage("adult-cozy", LifeStage.Adult, "Cozy Adult", 72, 0, 39),
      growthStage("adult-pal", LifeStage.Adult, "Desk Pal", 72, 40, 74),
      growthStage("adult-star", LifeStage.Adult, `Star ${overrides.name}`, 72, 75, 100)
    ],
    preferredFoods: ["warm rice", "fruit bite"],
    dislikedFoods: ["burnt toast"],
    favoritePlayStyle: PlayStyle.Rhythm,
    careModifiers: {
      hungerDecayMultiplier: 1,
      happinessDecayMultiplier: 1,
      energyDecayMultiplier: 1,
      cleanlinessDecayMultiplier: 1,
      affectionGainMultiplier: 1
    },
    colorPalette: overrides.colorPalette,
    author: "Deskagotchi",
    license: "Original Deskagotchi browser test asset",
    capabilities: ["browser-feedback", "placeholder-art"],
    validationStatus: PackageValidationStatus.Passed,
    assetHash: `${overrides.packageId}-browser-dev`,
    generation: {
      mode: "local-placeholder"
    }
  };
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
 * Create an animation manifest row for the generated spritesheet.
 *
 * @param id - Animation identifier represented by the row.
 * @param row - Zero-based spritesheet row index.
 * @param fps - Playback rate for the animation.
 * @returns Package animation metadata for a four-frame row.
 */
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

/**
 * Create a care-score growth stage definition.
 *
 * @param id - Stable growth-stage identifier.
 * @param lifeStage - Lifecycle bucket represented by the stage.
 * @param label - Display label for the stage.
 * @param minAgeHours - Minimum pet age required for the stage.
 * @param careScoreMin - Inclusive minimum care score for the stage.
 * @param careScoreMax - Inclusive maximum care score for the stage.
 * @returns Package growth-stage metadata.
 */
function growthStage(
  id: string,
  lifeStage: LifeStage,
  label: string,
  minAgeHours: number,
  careScoreMin: number,
  careScoreMax: number
): PetPackage["growthStages"][number] {
  return {
    id,
    stage: lifeStage,
    label,
    minAgeHours,
    careScoreMin,
    careScoreMax,
    animationSet: Object.values(AnimationId)
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
 * Validate browser hatch input before installing a generated package.
 *
 * @param input - Hatch form values from the panel.
 * @returns Validation issues blocking installation, or an empty array.
 */
function validateHatchInput(input: HatchDraftInput): ValidationIssue[] {
  if (input.name.trim().length > 0) {
    return [];
  }
  return [
    {
      severity: ValidationSeverity.Error,
      code: "hatch_name_invalid",
      message: "Pet name is required."
    }
  ];
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
