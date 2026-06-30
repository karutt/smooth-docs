import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "#smooth-docs-theme/App";
import "highlight.js/styles/github-dark.css";
import "#smooth-docs-theme/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
