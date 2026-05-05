import { useEffect, useMemo, useState } from "react";

import type { DeskagotchiSnapshot } from "@shared/ipc";
import { PanelView } from "@shared/ipc";

import { OverlayApp } from "./components/OverlayApp";
import { PanelApp } from "./components/PanelApp";

interface RouteState {
  mode: "overlay" | "panel";
  panelView: PanelView;
}

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

function getRouteState(): RouteState {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/");
  const mode = parts[0] === "panel" ? "panel" : "overlay";
  const panelView = parsePanelView(parts[1]);
  return { mode, panelView };
}

function parsePanelView(value: string | undefined): PanelView {
  switch (value) {
    case PanelView.Settings:
      return PanelView.Settings;
    case PanelView.Hatch:
      return PanelView.Hatch;
    case PanelView.PetSelector:
      return PanelView.PetSelector;
    case PanelView.Status:
    default:
      return PanelView.Status;
  }
}
