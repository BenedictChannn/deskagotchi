import React from "react";
import ReactDOM from "react-dom/client";

import "./styles.css";

function App(): React.JSX.Element {
  return (
    <main className="app-shell">
      <h1>Deskagotchi</h1>
      <p>Desktop pet runtime scaffold.</p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
