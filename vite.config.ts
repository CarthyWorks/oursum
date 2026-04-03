import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
	plugins: [react()],
	root: "src/renderer",
	resolve: {
		alias: {
			// @/ resolves to src/renderer/ — required for shadcn/ui components.json
			"@": path.resolve(__dirname, "src/renderer"),
		},
	},
	// Exclude electrobun from dep pre-bundling — it ships TypeScript source files
	// and must be transformed by Vite's esbuild pipeline rather than pre-optimised.
	optimizeDeps: {
		exclude: ["electrobun"],
	},
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
