import { renameSync, existsSync, readFileSync } from "fs";
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
	// Use Inno Setup to produce a proper GUI installer (select path, desktop shortcut, uninstaller)
	const buildDir = join(import.meta.dir, "..", "build", "stable-win-x64");
	if (!existsSync(buildDir)) {
		console.error(`Windows build directory not found: ${buildDir}`);
		process.exit(1);
	}
	const iscc = "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe";
	const issScript = join(import.meta.dir, "installer.iss");
	const projectRoot = join(import.meta.dir, "..");
	console.log("Compiling Inno Setup installer...");
	execSync(`"${iscc}" /DMyAppVersion=${version} "${issScript}"`, {
		stdio: "inherit",
		cwd: projectRoot,
	});
	const dest = join(import.meta.dir, "..", "artifacts", `Oursum-beta-${version}-win-x64.exe`);
	if (!existsSync(dest)) {
		console.error(`Inno Setup output not found: ${dest}`);
		process.exit(1);
	}
	console.log(`Windows installer ready: ${dest}`);
} else {
	console.error(`Unsupported platform: ${platform}`);
	process.exit(1);
}
