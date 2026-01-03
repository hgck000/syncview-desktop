/* eslint-disable @typescript-eslint/no-explicit-any */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// import './styles/index.css'
import App from "./App.tsx";
import { useApp } from "./app/store";

if (import.meta.env.DEV) {
  (window as any).appStore = useApp;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
