import { useEffect, useMemo, useState } from "react";

import type { DeskagotchiSnapshot } from "@shared/ipc";
import { PanelView } from "@shared/ipc";

import { OverlayApp } from "./components/OverlayApp";
import { PanelApp } from "./components/PanelApp";

/** Route state derived from the renderer hash fragment. */
interface RouteState {
  /** Window mode selected by the URL hash. */
  mode: "overlay" | "panel";
  /** Initial panel subview requested by deep links. */
  panelView: PanelView;
}

/**
 * Render the Deskagotchi overlay or control panel from the current bridge state.
 *
 * @returns The active renderer surface for the current route.
 */
export function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<DeskagotchiSnapshot>();
  const [route, setRoute] = useState<RouteState>(() => getRouteState());
  const [error, setError] = useState<string>();

  useEffect(() => {
    const refresh = async (): Promise<void> => {
      try {
        setSnapshot(await window.deskagotchi.getSnapshot());
        setError(undefined);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Deskagotchi could not load."
        );
      }
    };

    void refresh();
    const removeListener = window.deskagotchi.onSnapshotUpdated(() => {
      void refresh();
    });
    const onHashChange = (): void => setRoute(getRouteState());
    window.addEventListener("hashchange", onHashChange);

    return () => {
      removeListener();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const content = useMemo(() => {
    if (error !== undefined) {
      return (
        <main className="fatal-state">
          <h1>Deskagotchi</h1>
          <p>{error}</p>
        </main>
      );
    }

    if (snapshot === undefined) {
      return <main className="loading-state" aria-label="Loading Deskagotchi" />;
    }

    if (route.mode === "panel") {
      return <PanelApp initialView={route.panelView} snapshot={snapshot} />;
    }

    return <OverlayApp snapshot={snapshot} />;
  }, [error, route.mode, route.panelView, snapshot]);

  return content;
}

/**
 * Parse the current hash route into the renderer mode and panel view.
 *
 * @returns The route state used to select the top-level renderer surface.
 */
function getRouteState(): RouteState {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/");
  const mode = parts[0] === "panel" ? "panel" : "overlay";
  const panelView = parsePanelView(parts[1]);
  return { mode, panelView };
}

/**
 * Normalize a route segment into a supported panel view.
 *
 * @param value - Raw panel route segment from the URL hash.
 * @returns The matching panel view, or the status view when the segment is missing or unknown.
 */
function parsePanelView(value: string | undefined): PanelView {
  switch (value) {
    case PanelView.Settings:
      return PanelView.Settings;
    case PanelView.PetSelector:
      return PanelView.PetSelector;
    case PanelView.Status:
    default:
      return PanelView.Status;
  }
}
