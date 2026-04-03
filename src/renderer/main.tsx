import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
// Initialize Electrobun IPC transport before mounting React;
// import has side-effect: opens WebSocket to the Bun process
import "./ipc/bridge";
import App from "./App";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
