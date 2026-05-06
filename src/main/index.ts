/**
 * Electron main-process entrypoint for Deskagotchi.
 *
 * Owns single-instance startup, privileged asset protocol registration, native
 * windows, tray actions, and the background simulation timer.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  type IpcMainInvokeEvent,
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
import { z } from "zod";

import {
  CareActionType,
  ColorHexSchema,
  DeskagotchiSaveSchema,
  PetPackageSchema
} from "@shared/domain";
import {
  IpcChannel,
  PanelView,
  type UpdateSettingsInput
} from "@shared/ipc";
import { ItemCatalogEntrySchema } from "@shared/itemIcons";

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

const PET_WINDOW_DEFAULT_SIZE = 240;
const PANEL_WIDTH = 720;
const PANEL_HEIGHT = 620;
const LOCAL_DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const CareActionInputSchema = z
  .object({
    type: z.nativeEnum(CareActionType),
    itemId: ItemCatalogEntrySchema.shape.id.optional()
  })
  .strict();
const PanelViewInputSchema = z.nativeEnum(PanelView);
const BooleanInputSchema = z.boolean();
const PackageIdInputSchema = PetPackageSchema.shape.packageId;
const UpdateSettingsInputSchema = DeskagotchiSaveSchema.shape.settings
  .partial()
  .strict();
const WindowDragDeltaInputSchema = z
  .object({
    deltaX: z.number().finite().min(-4096).max(4096),
    deltaY: z.number().finite().min(-4096).max(4096)
  })
  .strict();
const OptionalHatchTextSchema = z.string().trim().max(120).optional();
const HatchDraftInputSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    description: z.string().trim().min(1).max(280),
    species: z.string().trim().min(1).max(80),
    personality: z.string().trim().min(1).max(120),
    preferredColors: z.array(ColorHexSchema).min(2).max(8),
    accessory: OptionalHatchTextSchema,
    theme: OptionalHatchTextSchema
  })
  .strict();

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
    resetPetWindow();
    showPetWindow();
  });

  void app
    .whenReady()
    .then(async () => {
      app.setAppUserModelId("app.deskagotchi.desktop");
      runtime = new DeskagotchiRuntime(getResourceRoot(), app.getPath("userData"));
      await runtime.initialize();
      const startupSnapshot = await runtime.getSnapshot();
      applySettings(startupSnapshot.save.settings);
      registerAssetProtocol();
      registerIpcHandlers();
      createPetWindow();
      createTray();
      startSimulationTimer();
      powerMonitor.on("resume", () => void tickSimulation());
      powerMonitor.on("unlock-screen", () => void tickSimulation());
    })
    .catch((error: unknown) => {
      console.error(error);
      app.quit();
    });
}

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // Keep the companion alive in the tray until the explicit quit command.
});

/**
 * Resolve the packaged or development resource directory.
 *
 * @returns Absolute path that contains built-in pet resources.
 */
function getResourceRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "resources")
    : path.join(app.getAppPath(), "resources");
}

function getPreloadPath(): string {
  return path.join(__dirname, "../preload/index.mjs");
}

function getRendererFilePath(): string {
  return path.join(__dirname, "../renderer/index.html");
}

/**
 * Create the transparent pet overlay window after persisted state is available.
 *
 * The overlay is hidden instead of closed during normal operation so the tray
 * remains the owner of the app lifetime.
 */
function createPetWindow(): void {
  const snapshotPromise = runtime.getSnapshot();
  snapshotPromise
    .then((snapshot) => {
      const savedBounds = snapshot.save.settings.petWindowBounds;
      const bounds = ensureVisibleBounds(
        savedBounds ?? {
          ...defaultPetWindowBounds(),
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
      petWindow.webContents.on("did-finish-load", () => {
        petWindow?.show();
        petWindow?.moveTop();
      });
      void petWindow.loadURL(createRendererUrl("overlay"));
    })
    .catch((error) => {
      console.error(error);
      app.quit();
    });
}

/**
 * Create or focus the control panel window on a specific panel route.
 *
 * @param view - Initial panel view to show.
 */
function createPanelWindow(view: PanelView): void {
  if (panelWindow !== undefined && !panelWindow.isDestroyed()) {
    void panelWindow.loadURL(createRendererUrl("panel", view));
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
  panelWindow.on("close", () => {
    if (!app.isPackaged && !isQuitting) {
      isQuitting = true;
      app.quit();
    }
  });
  panelWindow.on("closed", () => {
    panelWindow = undefined;
  });
  void panelWindow.loadURL(createRendererUrl("panel", view));
}

/**
 * Build the renderer URL for dev-server and packaged app modes.
 *
 * @param mode - Renderer route family to open.
 * @param view - Optional panel subview.
 * @returns URL with the hash route expected by the renderer.
 */
function createRendererUrl(mode: "overlay" | "panel", view?: PanelView): string {
  const hash = view === undefined ? `#/${mode}` : `#/${mode}/${view}`;
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL !== undefined) {
    return `${process.env.ELECTRON_RENDERER_URL}${hash}`;
  }
  return `${pathToFileURL(getRendererFilePath()).toString()}${hash}`;
}

/**
 * Register the custom protocol that exposes pet package assets to sandboxed renderers.
 *
 * @throws Error when the runtime cannot resolve a requested package asset.
 */
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

/**
 * Bind renderer IPC commands to runtime mutations and native-window effects.
 *
 * Handlers that mutate pet or settings state also broadcast a snapshot invalidation
 * so open windows refresh through their normal data path.
 */
function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.GetSnapshot, (event) => {
    validateIpcSender(event);
    return runtime.getSnapshot();
  });
  ipcMain.handle(IpcChannel.PerformAction, async (event, actionInput: unknown) => {
    validateIpcSender(event);
    const validatedAction = parseIpcInput(
      CareActionInputSchema,
      actionInput,
      "care action"
    );
    const snapshot = await runtime.performAction(validatedAction);
    broadcastSnapshotUpdated();
    rebuildTray();
    return snapshot;
  });
  ipcMain.handle(IpcChannel.SwitchPet, async (event, packageId: unknown) => {
    validateIpcSender(event);
    const validatedPackageId = parseIpcInput(
      PackageIdInputSchema,
      packageId,
      "package id"
    );
    const snapshot = await runtime.switchPet(validatedPackageId);
    broadcastSnapshotUpdated();
    rebuildTray();
    return snapshot;
  });
  ipcMain.handle(IpcChannel.UpdateSettings, async (event, settings: unknown) => {
    validateIpcSender(event);
    const validatedSettings = parseIpcInput(
      UpdateSettingsInputSchema,
      settings,
      "settings update"
    );
    const snapshot = await runtime.updateSettings(validatedSettings);
    applySettings(snapshot.save.settings);
    broadcastSnapshotUpdated();
    rebuildTray();
    return snapshot;
  });
  ipcMain.handle(IpcChannel.OpenPanel, (event, view: unknown) => {
    validateIpcSender(event);
    createPanelWindow(parseIpcInput(PanelViewInputSchema, view, "panel view"));
  });
  ipcMain.handle(IpcChannel.HidePanel, (event) => {
    validateIpcSender(event);
    if (!app.isPackaged) {
      isQuitting = true;
      app.quit();
      return;
    }

    panelWindow?.hide();
  });
  ipcMain.handle(IpcChannel.ResetPetWindow, async (event) => {
    validateIpcSender(event);
    resetPetWindow();
    await persistPetWindowBounds();
  });
  ipcMain.handle(IpcChannel.MovePetWindow, (event, delta: unknown) => {
    validateIpcSender(event);
    movePetWindow(
      parseIpcInput(WindowDragDeltaInputSchema, delta, "window drag delta")
    );
  });
  ipcMain.handle(IpcChannel.FinishPetWindowDrag, async (event) => {
    validateIpcSender(event);
    await persistPetWindowBounds();
  });
  ipcMain.handle(IpcChannel.SetClickThrough, (event, enabled: unknown) => {
    validateIpcSender(event);
    petWindow?.setIgnoreMouseEvents(
      parseIpcInput(BooleanInputSchema, enabled, "click-through flag"),
      { forward: true }
    );
  });
  ipcMain.handle(IpcChannel.HatchCreateDraft, async (event, input: unknown) => {
    validateIpcSender(event);
    const result = await runtime.hatchCreateDraft(
      parseIpcInput(HatchDraftInputSchema, input, "hatch draft")
    );
    broadcastSnapshotUpdated();
    rebuildTray();
    return result;
  });
  ipcMain.handle(IpcChannel.ExportPet, (event, packageId: unknown) => {
    validateIpcSender(event);
    return runtime.exportPet(
      parseIpcInput(PackageIdInputSchema, packageId, "package id")
    );
  });
  ipcMain.handle(IpcChannel.ImportPet, async (event) => {
    validateIpcSender(event);
    const snapshot = await runtime.importPet();
    broadcastSnapshotUpdated();
    rebuildTray();
    return snapshot;
  });
}

function validateIpcSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url ?? event.sender.getURL();
  if (!isTrustedRendererUrl(senderUrl)) {
    throw new Error("Rejected IPC call from an untrusted renderer origin.");
  }
}

function isTrustedRendererUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol === "file:") {
    url.hash = "";
    url.search = "";
    return (
      path.normalize(fileURLToPath(url)) === path.normalize(getRendererFilePath())
    );
  }

  return (
    !app.isPackaged &&
    (url.protocol === "http:" || url.protocol === "https:") &&
    LOCAL_DEV_HOSTNAMES.has(url.hostname)
  );
}

function parseIpcInput<T>(
  schema: z.ZodType<T>,
  value: unknown,
  inputName: string
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid IPC ${inputName}.`);
  }
  return result.data;
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

/**
 * Apply a care action initiated from the tray menu.
 *
 * @param actionType - Care action to apply to the active pet.
 */
async function performTrayAction(actionType: CareActionType): Promise<void> {
  await runtime.performAction({ type: actionType });
  broadcastSnapshotUpdated();
  showPetWindow();
}

/**
 * Create the small native tray image without relying on external assets.
 *
 * @returns Native image suitable for Electron's Tray API.
 */
function createTrayIcon(): Electron.NativeImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="17" r="11" fill="#f7b267" stroke="#2f243a" stroke-width="3"/><path d="M9 12 L11 5 L16 11 L21 5 L23 12" fill="#f7b267" stroke="#2f243a" stroke-width="3" stroke-linejoin="round"/><circle cx="12" cy="16" r="2" fill="#2f243a"/><circle cx="20" cy="16" r="2" fill="#2f243a"/><path d="M12 22 Q16 25 20 22" fill="none" stroke="#2f243a" stroke-width="2" stroke-linecap="round"/></svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  );
}

/**
 * Apply native Electron settings that mirror persisted user preferences.
 *
 * @param settings - Partial settings update or full saved settings object.
 */
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

/**
 * Show the pet overlay, recreating it if Electron destroyed the native window.
 */
function showPetWindow(): void {
  if (petWindow === undefined || petWindow.isDestroyed()) {
    createPetWindow();
    return;
  }
  petWindow.show();
  petWindow.focus();
}

/**
 * Return the pet overlay to the default visible location and size.
 */
function resetPetWindow(): void {
  const { x, y } = defaultPetWindowBounds();
  petWindow?.setBounds({
    x,
    y,
    width: PET_WINDOW_DEFAULT_SIZE,
    height: PET_WINDOW_DEFAULT_SIZE
  });
  petWindow?.show();
  petWindow?.moveTop();
}

/**
 * Move the pet overlay by a renderer-reported pointer delta.
 *
 * @param delta - Screen-pixel movement since the previous pointer event.
 */
function movePetWindow(delta: { deltaX: number; deltaY: number }): void {
  if (petWindow === undefined || petWindow.isDestroyed()) {
    return;
  }

  const bounds = petWindow.getBounds();
  petWindow.setBounds(
    ensureVisibleBounds({
      ...bounds,
      x: bounds.x + Math.round(delta.deltaX),
      y: bounds.y + Math.round(delta.deltaY)
    })
  );
}

/**
 * Compute the default lower-right overlay position on the primary display.
 *
 * @returns Overlay origin that leaves a small inset from the work area edge.
 */
function defaultPetWindowBounds(): { x: number; y: number } {
  const display = screen.getPrimaryDisplay();
  return {
    x: display.workArea.x + display.workArea.width - PET_WINDOW_DEFAULT_SIZE - 40,
    y: display.workArea.y + display.workArea.height - PET_WINDOW_DEFAULT_SIZE - 40
  };
}

/**
 * Persist the current overlay bounds if the pet window is alive.
 */
async function persistPetWindowBounds(): Promise<void> {
  if (petWindow === undefined || petWindow.isDestroyed()) {
    return;
  }
  const bounds = petWindow.getBounds();
  await runtime.updatePetWindowBounds(bounds);
}

/**
 * Clamp saved window bounds onto an available display work area.
 *
 * @param bounds - Previously saved or default Electron bounds.
 * @returns Bounds with sane size limits and a visible origin.
 */
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

/**
 * Progress the simulation and notify renderers that a fresh snapshot is available.
 */
async function tickSimulation(): Promise<void> {
  await runtime.getSnapshot();
  runtime.maybeNotifyAttention();
  broadcastSnapshotUpdated();
}

function broadcastSnapshotUpdated(): void {
  petWindow?.webContents.send(IpcChannel.SnapshotUpdated);
  panelWindow?.webContents.send(IpcChannel.SnapshotUpdated);
}

app.on("will-quit", () => {
  if (simulationTimer !== undefined) {
    clearInterval(simulationTimer);
  }
});
