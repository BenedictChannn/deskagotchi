/**
 * Shared IPC contract between Electron main, preload, and renderer code.
 *
 * @module
 */
import type {
  CareActionType,
  DeskagotchiSave,
  PetInstanceState,
  PetPackage,
  ValidationIssue
} from "./domain";
import type { ItemCatalogEntry } from "./itemIcons";

/** IPC channel names shared by preload, renderer, and Electron main process. */
export enum IpcChannel {
  GetSnapshot = "deskagotchi:getSnapshot",
  PerformAction = "deskagotchi:performAction",
  SwitchPet = "deskagotchi:switchPet",
  UpdateSettings = "deskagotchi:updateSettings",
  OpenPanel = "deskagotchi:openPanel",
  HidePanel = "deskagotchi:hidePanel",
  ResetPetWindow = "deskagotchi:resetPetWindow",
  MovePetWindow = "deskagotchi:movePetWindow",
  FinishPetWindowDrag = "deskagotchi:finishPetWindowDrag",
  EnterPetWindowPlayMode = "deskagotchi:enterPetWindowPlayMode",
  ExitPetWindowPlayMode = "deskagotchi:exitPetWindowPlayMode",
  SetClickThrough = "deskagotchi:setClickThrough",
  RecordQaEvent = "deskagotchi:recordQaEvent",
  HatchCreateDraft = "deskagotchi:hatchCreateDraft",
  ExportPet = "deskagotchi:exportPet",
  ImportPet = "deskagotchi:importPet",
  SnapshotUpdated = "deskagotchi:snapshotUpdated"
}

/** Panel routes the main process can ask the renderer shell to display. */
export enum PanelView {
  Status = "status",
  Settings = "settings",
  Hatch = "hatch",
  PetSelector = "pet-selector"
}

/** Runtime package view with resolved asset URLs and validation issues. */
export interface RuntimePetPackage {
  petPackage: PetPackage;
  assetUrls: {
    spritesheet: string;
    preview: string;
    icon: string;
  };
  issues: ValidationIssue[];
}

/** Complete state snapshot sent from Electron main to the renderer. */
export interface DeskagotchiSnapshot {
  save: DeskagotchiSave;
  activeState: PetInstanceState;
  activePackage: RuntimePetPackage;
  packages: RuntimePetPackage[];
  appVersion: string;
  userDataPath: string;
}

/** Input collected by Hatch before generating or installing a draft pet package. */
export interface HatchDraftInput {
  name: string;
  description: string;
  species: string;
  personality: string;
  preferredColors: string[];
  accessory?: string;
  theme?: string;
}

/** Result of creating and installing a Hatch draft package. */
export interface HatchDraftResult {
  packageId: string;
  installed: boolean;
  issues: ValidationIssue[];
}

/** Renderer-originated QA telemetry event passed through the preload bridge. */
export interface QaTelemetryInput {
  event: string;
  source?: string;
  windowRole?: string;
  displayId?: string;
  scaleFactor?: number;
  payload?: Record<string, unknown>;
  error?: string;
}

/** Care action request sent by renderer controls. */
export interface CareActionRequest {
  type: CareActionType;
  itemId?: ItemCatalogEntry["id"];
}

/** Partial save-settings update accepted over IPC. */
export type UpdateSettingsInput = Partial<DeskagotchiSave["settings"]>;

/** Renderer-facing API exposed by preload for desktop pet operations. */
export interface DeskagotchiApi {
  getSnapshot: () => Promise<DeskagotchiSnapshot>;
  performAction: (request: CareActionRequest) => Promise<DeskagotchiSnapshot>;
  switchPet: (packageId: string) => Promise<DeskagotchiSnapshot>;
  updateSettings: (
    settings: UpdateSettingsInput
  ) => Promise<DeskagotchiSnapshot>;
  openPanel: (view: PanelView) => Promise<void>;
  hidePanel: () => Promise<void>;
  resetPetWindow: () => Promise<void>;
  movePetWindow: (deltaX: number, deltaY: number) => Promise<void>;
  finishPetWindowDrag: () => Promise<void>;
  enterPetWindowPlayMode: () => Promise<void>;
  exitPetWindowPlayMode: () => Promise<void>;
  setClickThrough: (enabled: boolean) => Promise<void>;
  recordQaEvent: (event: QaTelemetryInput) => Promise<void>;
  hatchCreateDraft: (input: HatchDraftInput) => Promise<HatchDraftResult>;
  exportPet: (packageId: string) => Promise<string | undefined>;
  importPet: () => Promise<DeskagotchiSnapshot>;
  onSnapshotUpdated: (callback: () => void) => () => void;
}
