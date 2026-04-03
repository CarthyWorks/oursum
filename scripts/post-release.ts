import { renameSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8"));
const version: string = pkg.version;

const artifactsDir = join(import.meta.dir, "..", "artifacts");
const src = join(artifactsDir, "stable-macos-arm64-Oursum.dmg");
const dest = join(artifactsDir, `Oursum-beta-${version}.dmg`);

if (!existsSync(src)) {
	console.error(`DMG not found: ${src}`);
	process.exit(1);
}

renameSync(src, dest);
console.log(`Renamed: stable-macos-arm64-Oursum.dmg → Oursum-beta-${version}.dmg`);
