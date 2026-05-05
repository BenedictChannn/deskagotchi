import { contextBridge, ipcRenderer } from "electron";

import {
  type DeskagotchiApi,
  type HatchDraftInput,
  IpcChannel,
  type PanelView,
  type UpdateSettingsInput
} from "@shared/ipc";
import type { CareActionType } from "@shared/domain";

const api: DeskagotchiApi = {
  getSnapshot: () => ipcRenderer.invoke(IpcChannel.GetSnapshot),
  performAction: (actionType: CareActionType) =>
    ipcRenderer.invoke(IpcChannel.PerformAction, actionType),
  switchPet: (packageId: string) =>
    ipcRenderer.invoke(IpcChannel.SwitchPet, packageId),
  updateSettings: (settings: UpdateSettingsInput) =>
    ipcRenderer.invoke(IpcChannel.UpdateSettings, settings),
  openPanel: (view: PanelView) => ipcRenderer.invoke(IpcChannel.OpenPanel, view),
  hidePanel: () => ipcRenderer.invoke(IpcChannel.HidePanel),
  resetPetWindow: () => ipcRenderer.invoke(IpcChannel.ResetPetWindow),
  setClickThrough: (enabled: boolean) =>
    ipcRenderer.invoke(IpcChannel.SetClickThrough, enabled),
  hatchCreateDraft: (input: HatchDraftInput) =>
    ipcRenderer.invoke(IpcChannel.HatchCreateDraft, input),
  exportPet: (packageId: string) => ipcRenderer.invoke(IpcChannel.ExportPet, packageId),
  importPet: () => ipcRenderer.invoke(IpcChannel.ImportPet),
  onSnapshotUpdated: (callback: () => void) => {
    const listener = (): void => callback();
    ipcRenderer.on(IpcChannel.SnapshotUpdated, listener);
    return () => ipcRenderer.removeListener(IpcChannel.SnapshotUpdated, listener);
  }
};

contextBridge.exposeInMainWorld("deskagotchi", api);
