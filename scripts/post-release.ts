import { renameSync, existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8"));
const version: string = pkg.version;

const artifactsDir = join(import.meta.dir, "..", "artifacts");

function renameArtifact(src: string, dest: string): void {
	if (!existsSync(src)) {
		console.error(`Artifact not found: ${src}`);
		process.exit(1);
	}
	renameSync(src, dest);
	console.log(`Renamed: ${src} → ${dest}`);
}

const platform = process.platform;
const arch = process.arch;

if (platform === "darwin") {
	const electrobunArch = arch === "arm64" ? "arm64" : "x64";
	const platformKey = `macos-${electrobunArch}`;
	const src = join(artifactsDir, `stable-${platformKey}-Oursum.dmg`);
	const dest = join(artifactsDir, `Oursum-beta-${version}-${platformKey}.dmg`);
	renameArtifact(src, dest);
} else if (platform === "win32") {
	// Electrobun Windows: look for the primary installer artifact
	const winFiles = existsSync(artifactsDir)
		? readdirSync(artifactsDir).filter(
				(f) => f.startsWith("stable-win-x64-Oursum") && !f.endsWith("update.json"),
		  )
		: [];
	if (winFiles.length === 0) {
		console.error("No Windows artifact found in artifacts/");
		process.exit(1);
	}
	const winFile = winFiles[0];
	const ext = winFile.substring(winFile.lastIndexOf("."));
	const dest = join(artifactsDir, `Oursum-beta-${version}-win-x64${ext}`);
	renameArtifact(join(artifactsDir, winFile), dest);
} else {
	console.error(`Unsupported platform: ${platform}`);
	process.exit(1);
}
