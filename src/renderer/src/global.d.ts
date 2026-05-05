import type { DeskagotchiApi } from "@shared/ipc";

declare global {
  interface Window {
    deskagotchi: DeskagotchiApi;
  }
}

export {};
