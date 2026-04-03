// src/main/index.ts — Electrobun framework layer ONLY
// RULE: Zero business logic here. All business logic lives in src/core/.
import { ApplicationMenu, BrowserWindow, Updater } from "electrobun/bun";
import { bunRPC, setMainWindow } from "./ipc/bridge";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

const url = await getMainViewUrl();

let mainWindow: BrowserWindow | null = null;

function hasOpenMainWindow(): boolean {
	return mainWindow !== null && BrowserWindow.getById(mainWindow.id) !== undefined;
}

function createMainWindow(): BrowserWindow {
	if (hasOpenMainWindow()) {
		return mainWindow!;
	}

	// bunRPC is passed directly to BrowserWindow — it sets up the typed WebSocket
	// IPC transport between this Bun process and the renderer's Electroview instance.
	const window = new BrowserWindow({
		title: "Oursum",
		url,
		rpc: bunRPC,
		frame: {
			width: 1280,
			height: 800,
			x: 100,
			y: 100,
		},
		titleBarStyle: "hiddenInset",
	});

	window.on("close", () => {
		if (mainWindow?.id === window.id) {
			mainWindow = null;
			setMainWindow(null);
		}
	});

	mainWindow = window;
	setMainWindow(window);
	return window;
}

function focusOrCreateMainWindow() {
	const window = createMainWindow();
	if (window.isMinimized()) {
		window.unminimize();
	}
	window.focus();
	return window;
}

ApplicationMenu.on("application-menu-clicked", (event) => {
	const action = (event as { data?: { action?: string } }).data?.action;

	if (action === "new-window") {
		focusOrCreateMainWindow();
		return;
	}

	if (action === "close-main-window" && process.platform === "darwin" && hasOpenMainWindow()) {
		mainWindow!.close();
	}
});

ApplicationMenu.setApplicationMenu([
	{
		label: "Oursum",
		submenu: [
			{ label: "New Window", action: "new-window", accelerator: "CommandOrControl+N" },
			{ type: "separator" },
			{ role: "quit", accelerator: "CommandOrControl+Q" },
		],
	},
	{
		label: "Window",
		submenu: [
			{ label: "Close Window", action: "close-main-window", accelerator: "CommandOrControl+W" },
			{ role: "minimize", accelerator: "CommandOrControl+M" },
		],
	},
]);

focusOrCreateMainWindow();

console.log("Oursum started!");
