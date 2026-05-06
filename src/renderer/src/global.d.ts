import type { DeskagotchiApi } from "@shared/ipc";

declare global {
  interface Window {
    /** Bridge API exposed by Electron preload or the browser development adapter. */
    deskagotchi: DeskagotchiApi;
  }
}

export {};
