import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  net,
  powerMonitor,
  protocol,
  screen,
  Tray,
  type Rectangle
} from "electron";

import { CareActionType } from "@shared/domain";
import { IpcChannel, PanelView, type UpdateSettingsInput } from "@shared/ipc";

import { DeskagotchiRuntime } from "./runtime";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "deskagotchi",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

const PET_WINDOW_DEFAULT_SIZE = 180;
const PANEL_WIDTH = 720;
const PANEL_HEIGHT = 620;

let runtime: DeskagotchiRuntime;
let petWindow: BrowserWindow | undefined;
let panelWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let isQuitting = false;
let simulationTimer: NodeJS.Timeout | undefined;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showPetWindow();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId("app.deskagotchi.desktop");
    runtime = new DeskagotchiRuntime(getResourceRoot(), app.getPath("userData"));
    await runtime.initialize();
    registerAssetProtocol();
    registerIpcHandlers();
    createPetWindow();
    createTray();
    startSimulationTimer();
    powerMonitor.on("resume", () => void tickSimulation());
    powerMonitor.on("unlock-screen", () => void tickSimulation());
  });
}

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // Keep the companion alive in the tray until the explicit quit command.
});

function getResourceRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "resources")
    : path.join(app.getAppPath(), "resources");
}

function getPreloadPath(): string {
  return path.join(__dirname, "../preload/index.js");
}

function createPetWindow(): void {
  const snapshotPromise = runtime.getSnapshot();
  snapshotPromise
    .then((snapshot) => {
      const savedBounds = snapshot.save.settings.petWindowBounds;
      const bounds = ensureVisibleBounds(
        savedBounds ?? {
          x: 80,
          y: 80,
          width: PET_WINDOW_DEFAULT_SIZE,
          height: PET_WINDOW_DEFAULT_SIZE
        }
      );

      petWindow = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        frame: false,
        transparent: true,
        resizable: false,
        skipTaskbar: true,
        hasShadow: false,
        alwaysOnTop: snapshot.save.settings.alwaysOnTop,
        backgroundColor: "#00000000",
        webPreferences: {
          preload: getPreloadPath(),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      });

      petWindow.setMenu(null);
      petWindow.setVisibleOnAllWorkspaces(false);
      petWindow.on("close", (event) => {
        if (!isQuitting) {
          event.preventDefault();
          petWindow?.hide();
        }
      });
      petWindow.on("moved", () => void persistPetWindowBounds());
      petWindow.on("resize", () => void persistPetWindowBounds());
      petWindow.loadURL(createRendererUrl("overlay"));
    })
    .catch((error) => {
      console.error(error);
      app.quit();
    });
}

function createPanelWindow(view: PanelView): void {
  if (panelWindow !== undefined && !panelWindow.isDestroyed()) {
    panelWindow.loadURL(createRendererUrl("panel", view));
    panelWindow.show();
    panelWindow.focus();
    return;
  }

  panelWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    minWidth: 560,
    minHeight: 520,
    title: "Deskagotchi",
    backgroundColor: "#f8f5ef",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  panelWindow.setMenu(null);
  panelWindow.on("closed", () => {
    panelWindow = undefined;
  });
  panelWindow.loadURL(createRendererUrl("panel", view));
}

function createRendererUrl(mode: "overlay" | "panel", view?: PanelView): string {
  const hash = view === undefined ? `#/${mode}` : `#/${mode}/${view}`;
  if (process.env.ELECTRON_RENDERER_URL !== undefined) {
    return `${process.env.ELECTRON_RENDERER_URL}${hash}`;
  }
  return `${pathToFileURL(path.join(__dirname, "../renderer/index.html")).toString()}${hash}`;
}

function registerAssetProtocol(): void {
  protocol.handle("deskagotchi", async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== "pet-asset") {
      return new Response("Unknown Deskagotchi protocol host.", { status: 404 });
    }
    const pathParts = url.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
    const packageId = pathParts[0];
    const relativeAssetPath = pathParts.slice(1).join("/");
    if (packageId === undefined || relativeAssetPath.length === 0) {
      return new Response("Missing Deskagotchi asset path.", { status: 400 });
    }
    const assetPath = runtime.resolveAsset(packageId, relativeAssetPath);
    return net.fetch(pathToFileURL(assetPath).toString());
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.GetSnapshot, () => runtime.getSnapshot());
  ipcMain.handle(IpcChannel.PerformAction, async (_event, actionType: CareActionType) => {
    const snapshot = await runtime.performAction(actionType);
    await broadcastSnapshotUpdated();
    rebuildTray();
    return snapshot;
  });
  ipcMain.handle(IpcChannel.SwitchPet, async (_event, packageId: string) => {
    const snapshot = await runtime.switchPet(packageId);
    await broadcastSnapshotUpdated();
    rebuildTray();
    return snapshot;
  });
  ipcMain.handle(IpcChannel.UpdateSettings, async (_event, settings: UpdateSettingsInput) => {
    const snapshot = await runtime.updateSettings(settings);
    applySettings(snapshot.save.settings);
    await broadcastSnapshotUpdated();
    rebuildTray();
    return snapshot;
  });
  ipcMain.handle(IpcChannel.OpenPanel, (_event, view: PanelView) => {
    createPanelWindow(view);
  });
  ipcMain.handle(IpcChannel.HidePanel, () => {
    panelWindow?.hide();
  });
  ipcMain.handle(IpcChannel.ResetPetWindow, async () => {
    resetPetWindow();
    await persistPetWindowBounds();
  });
  ipcMain.handle(IpcChannel.SetClickThrough, (_event, enabled: boolean) => {
    petWindow?.setIgnoreMouseEvents(enabled, { forward: true });
  });
  ipcMain.handle(IpcChannel.HatchCreateDraft, async (_event, input) => {
    const result = await runtime.hatchCreateDraft(input);
    await broadcastSnapshotUpdated();
    rebuildTray();
    return result;
  });
  ipcMain.handle(IpcChannel.ExportPet, (_event, packageId: string) =>
    runtime.exportPet(packageId)
  );
  ipcMain.handle(IpcChannel.ImportPet, async () => {
    const snapshot = await runtime.importPet();
    await broadcastSnapshotUpdated();
    rebuildTray();
    return snapshot;
  });
}

function createTray(): void {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Deskagotchi");
  rebuildTray();
}

function rebuildTray(): void {
  if (tray === undefined) {
    return;
  }
  const menu = Menu.buildFromTemplate([
    { label: "Show pet", click: () => showPetWindow() },
    { label: "Hide pet", click: () => petWindow?.hide() },
    { label: "Reset pet position", click: () => resetPetWindow() },
    { type: "separator" },
    {
      label: "Feed meal",
      click: () => void performTrayAction(CareActionType.FeedMeal)
    },
    { label: "Play", click: () => void performTrayAction(CareActionType.Play) },
    { label: "Clean", click: () => void performTrayAction(CareActionType.Clean) },
    {
      label: "Sleep / wake",
      click: () => void performTrayAction(CareActionType.ToggleSleep)
    },
    { type: "separator" },
    { label: "Health", click: () => createPanelWindow(PanelView.Status) },
    { label: "Switch pet", click: () => createPanelWindow(PanelView.PetSelector) },
    { label: "Hatch pet", click: () => createPanelWindow(PanelView.Hatch) },
    { label: "Settings", click: () => createPanelWindow(PanelView.Settings) },
    { type: "separator" },
    {
      label: "Quit Deskagotchi",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}

async function performTrayAction(actionType: CareActionType): Promise<void> {
  await runtime.performAction(actionType);
  await broadcastSnapshotUpdated();
  showPetWindow();
}

function createTrayIcon(): Electron.NativeImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="17" r="11" fill="#f7b267" stroke="#2f243a" stroke-width="3"/><path d="M9 12 L11 5 L16 11 L21 5 L23 12" fill="#f7b267" stroke="#2f243a" stroke-width="3" stroke-linejoin="round"/><circle cx="12" cy="16" r="2" fill="#2f243a"/><circle cx="20" cy="16" r="2" fill="#2f243a"/><path d="M12 22 Q16 25 20 22" fill="none" stroke="#2f243a" stroke-width="2" stroke-linecap="round"/></svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  );
}

function applySettings(settings: UpdateSettingsInput): void {
  if (settings.alwaysOnTop !== undefined) {
    petWindow?.setAlwaysOnTop(settings.alwaysOnTop);
  }
  if (settings.launchOnStartup !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: settings.launchOnStartup
    });
  }
}

function showPetWindow(): void {
  if (petWindow === undefined || petWindow.isDestroyed()) {
    createPetWindow();
    return;
  }
  petWindow.show();
  petWindow.focus();
}

function resetPetWindow(): void {
  const display = screen.getPrimaryDisplay();
  const x = display.workArea.x + display.workArea.width - PET_WINDOW_DEFAULT_SIZE - 32;
  const y = display.workArea.y + display.workArea.height - PET_WINDOW_DEFAULT_SIZE - 32;
  petWindow?.setBounds({
    x,
    y,
    width: PET_WINDOW_DEFAULT_SIZE,
    height: PET_WINDOW_DEFAULT_SIZE
  });
  petWindow?.show();
}

async function persistPetWindowBounds(): Promise<void> {
  if (petWindow === undefined || petWindow.isDestroyed()) {
    return;
  }
  const bounds = petWindow.getBounds();
  await runtime.updatePetWindowBounds(bounds);
}

function ensureVisibleBounds(bounds: Rectangle): Rectangle {
  const displays = screen.getAllDisplays();
  const matchingDisplay =
    displays.find((display) => rectsIntersect(display.workArea, bounds)) ??
    screen.getPrimaryDisplay();
  const workArea = matchingDisplay.workArea;
  const width = Math.min(Math.max(bounds.width, 96), 512);
  const height = Math.min(Math.max(bounds.height, 96), 512);
  const x = Math.min(
    Math.max(bounds.x, workArea.x),
    workArea.x + workArea.width - width
  );
  const y = Math.min(
    Math.max(bounds.y, workArea.y),
    workArea.y + workArea.height - height
  );

  return { x, y, width, height };
}

function rectsIntersect(first: Rectangle, second: Rectangle): boolean {
  return !(
    second.x + second.width < first.x ||
    second.x > first.x + first.width ||
    second.y + second.height < first.y ||
    second.y > first.y + first.height
  );
}

function startSimulationTimer(): void {
  simulationTimer = setInterval(() => void tickSimulation(), 60_000);
}

async function tickSimulation(): Promise<void> {
  await runtime.getSnapshot();
  await runtime.maybeNotifyAttention();
  await broadcastSnapshotUpdated();
}

async function broadcastSnapshotUpdated(): Promise<void> {
  petWindow?.webContents.send(IpcChannel.SnapshotUpdated);
  panelWindow?.webContents.send(IpcChannel.SnapshotUpdated);
}

app.on("will-quit", () => {
  if (simulationTimer !== undefined) {
    clearInterval(simulationTimer);
  }
});

app.whenReady().then(() => {
  console.log("Deskagotchi scaffold ready.");
});
