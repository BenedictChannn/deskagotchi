import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("deskagotchi", {
  version: "0.1.0"
});
