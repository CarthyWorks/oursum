import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "Oursum",
		identifier: "com.carthyworks.oursum",
		version: "0.0.1",
		description: "Oursum — personal expense tracker by CarthyWorks",
	},
	runtime: {
		exitOnLastWindowClosed: true,
	},
	build: {
		bun: {
			// Override default src/bun/index.ts → our architecture uses src/main/
			entrypoint: "src/main/index.ts",
		},
		// Vite builds to dist/, we copy from there
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
		},
		// Ignore Vite output in watch mode — HMR handles view rebuilds separately
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
			// Electrobun converts this folder to AppIcon.icns via iconutil at build time
			icons: "icon.iconset",
			// Sign when ELECTROBUN_DEVELOPER_ID is set (CI); skip silently otherwise
			codesign: !!process.env.ELECTROBUN_DEVELOPER_ID,
		},
		linux: {
			bundleCEF: false,
			icon: "icon.iconset/icon_512x512.png",
		},
		win: {
			bundleCEF: false,
			icon: "icon.ico",
		},
	},
} satisfies ElectrobunConfig;
