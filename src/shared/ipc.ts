import type {
  CareActionType,
  DeskagotchiSave,
  PetInstanceState,
  PetPackage,
  ValidationIssue
} from "./domain";

export enum IpcChannel {
  GetSnapshot = "deskagotchi:getSnapshot",
  PerformAction = "deskagotchi:performAction",
  SwitchPet = "deskagotchi:switchPet",
  UpdateSettings = "deskagotchi:updateSettings",
  OpenPanel = "deskagotchi:openPanel",
  HidePanel = "deskagotchi:hidePanel",
  ResetPetWindow = "deskagotchi:resetPetWindow",
  SetClickThrough = "deskagotchi:setClickThrough",
  HatchCreateDraft = "deskagotchi:hatchCreateDraft",
  ExportPet = "deskagotchi:exportPet",
  ImportPet = "deskagotchi:importPet",
  SnapshotUpdated = "deskagotchi:snapshotUpdated"
}

export enum PanelView {
  Status = "status",
  Settings = "settings",
  Hatch = "hatch",
  PetSelector = "pet-selector"
}

export interface RuntimePetPackage {
  petPackage: PetPackage;
  assetUrls: {
    spritesheet: string;
    preview: string;
    icon: string;
  };
  issues: ValidationIssue[];
}

export interface DeskagotchiSnapshot {
  save: DeskagotchiSave;
  activeState: PetInstanceState;
  activePackage: RuntimePetPackage;
  packages: RuntimePetPackage[];
  appVersion: string;
  userDataPath: string;
}

export interface HatchDraftInput {
  name: string;
  description: string;
  species: string;
  personality: string;
  preferredColors: string[];
  accessory?: string;
  theme?: string;
}

export interface HatchDraftResult {
  packageId: string;
  installed: boolean;
  issues: ValidationIssue[];
}

export type UpdateSettingsInput = Partial<DeskagotchiSave["settings"]>;

export interface DeskagotchiApi {
  getSnapshot: () => Promise<DeskagotchiSnapshot>;
  performAction: (actionType: CareActionType) => Promise<DeskagotchiSnapshot>;
  switchPet: (packageId: string) => Promise<DeskagotchiSnapshot>;
  updateSettings: (
    settings: UpdateSettingsInput
  ) => Promise<DeskagotchiSnapshot>;
  openPanel: (view: PanelView) => Promise<void>;
  hidePanel: () => Promise<void>;
  resetPetWindow: () => Promise<void>;
  setClickThrough: (enabled: boolean) => Promise<void>;
  hatchCreateDraft: (input: HatchDraftInput) => Promise<HatchDraftResult>;
  exportPet: (packageId: string) => Promise<string | undefined>;
  importPet: () => Promise<DeskagotchiSnapshot>;
  onSnapshotUpdated: (callback: () => void) => () => void;
}
