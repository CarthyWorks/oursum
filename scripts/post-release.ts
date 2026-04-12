import { renameSync, existsSync, readdirSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

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
	// Electrobun Windows: produces a .zip containing a Setup.exe — extract it
	const winFiles = existsSync(artifactsDir)
		? readdirSync(artifactsDir).filter(
				(f) => f.startsWith("stable-win-x64-Oursum") && !f.endsWith("update.json"),
		  )
		: [];
	if (winFiles.length === 0) {
		console.error("No Windows artifact found in artifacts/");
		process.exit(1);
	}
	const winZip = winFiles.find((f) => f.endsWith(".zip"));
	if (!winZip) {
		// Already an exe or unexpected format — rename as-is
		const winFile = winFiles[0];
		const ext = winFile.substring(winFile.lastIndexOf("."));
		renameArtifact(join(artifactsDir, winFile), join(artifactsDir, `Oursum-beta-${version}-win-x64${ext}`));
	} else {
		const zipSrc = join(artifactsDir, winZip);
		const extractDir = join(artifactsDir, "_win_extract");
		console.log(`Extracting ${winZip}...`);
		execSync(
			`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipSrc}' -DestinationPath '${extractDir}' -Force"`,
			{ stdio: "inherit" },
		);
		const exeFiles = readdirSync(extractDir).filter((f) => f.toLowerCase().endsWith(".exe"));
		if (exeFiles.length === 0) {
			console.error("No .exe found inside zip");
			process.exit(1);
		}
		const exeDest = join(artifactsDir, `Oursum-beta-${version}-win-x64.exe`);
		renameSync(join(extractDir, exeFiles[0]), exeDest);
		rmSync(extractDir, { recursive: true, force: true });
		rmSync(zipSrc);
		console.log(`Windows installer ready: ${exeDest}`);
	}
} else {
	console.error(`Unsupported platform: ${platform}`);
	process.exit(1);
}
