/** Renderer entry point that installs the development bridge and mounts React. */
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { installDevDeskagotchiApi } from "./devDeskagotchiApi";
import "./styles.css";

installDevDeskagotchiApi();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
