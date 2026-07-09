import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// React recommends createRoot for client rendering and StrictMode for new apps.
// Source: https://react.dev/reference/react-dom/client/createRoot
// Source: https://react.dev/reference/react/StrictMode
const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
