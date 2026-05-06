/** Electron preload entry point for the renderer bridge setup. */
import { contextBridge, ipcRenderer } from "electron";

import {
  type CareActionRequest,
  type DeskagotchiApi,
  type HatchDraftInput,
  IpcChannel,
  type PanelView,
  type UpdateSettingsInput
} from "@shared/ipc";

/**
 * Narrow IPC facade exposed to the renderer process.
 *
 * @remarks The renderer receives only typed bridge methods and never imports Electron directly.
 */
const api: DeskagotchiApi = {
  getSnapshot: () => ipcRenderer.invoke(IpcChannel.GetSnapshot),
  performAction: (request: CareActionRequest) =>
    ipcRenderer.invoke(IpcChannel.PerformAction, request),
  switchPet: (packageId: string) =>
    ipcRenderer.invoke(IpcChannel.SwitchPet, packageId),
  updateSettings: (settings: UpdateSettingsInput) =>
    ipcRenderer.invoke(IpcChannel.UpdateSettings, settings),
  openPanel: (view: PanelView) => ipcRenderer.invoke(IpcChannel.OpenPanel, view),
  hidePanel: () => ipcRenderer.invoke(IpcChannel.HidePanel),
  resetPetWindow: () => ipcRenderer.invoke(IpcChannel.ResetPetWindow),
  movePetWindow: (deltaX: number, deltaY: number) =>
    ipcRenderer.invoke(IpcChannel.MovePetWindow, { deltaX, deltaY }),
  finishPetWindowDrag: () => ipcRenderer.invoke(IpcChannel.FinishPetWindowDrag),
  enterPetWindowPlayMode: () =>
    ipcRenderer.invoke(IpcChannel.EnterPetWindowPlayMode),
  exitPetWindowPlayMode: () =>
    ipcRenderer.invoke(IpcChannel.ExitPetWindowPlayMode),
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

// Expose only the typed Deskagotchi bridge object to the isolated renderer world.
contextBridge.exposeInMainWorld("deskagotchi", api);
