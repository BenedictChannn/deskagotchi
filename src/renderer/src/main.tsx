/** Renderer entry point that installs the development bridge and mounts React. */
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import "./styles.css";

void bootstrapRenderer();

async function bootstrapRenderer(): Promise<void> {
  if (import.meta.env.DEV) {
    const { installDevDeskagotchiApi } = await import("./devDeskagotchiApi");
    installDevDeskagotchiApi();
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
