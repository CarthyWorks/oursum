#!/usr/bin/env bun
/**
 * Cross-platform app icon generator.
 * Renders an emoji using headless Chromium (Playwright) — works on macOS, Linux, and Windows.
 *
 * Produces:
 *   icon.iconset/  10 PNGs — Electrobun converts to AppIcon.icns at build time (macOS)
 *   icon.ico       Multi-resolution Windows icon (16–256 px, PNG-embedded, Vista+)
 *   icon.iconset/icon_512x512.png is also used as the Linux app icon
 *
 * Usage:
 *   bun scripts/generate-app-icon.ts [emoji]
 *   bun run generate-icon [emoji]          ← via package.json
 *
 * First run — install browsers once:
 *   bunx playwright install chromium
 */

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const EMOJI = process.argv[2] ?? "💸";
const PROJECT_ROOT = join(import.meta.dir, "..");
const ICONSET_DIR = join(PROJECT_ROOT, "icon.iconset");

// macOS iconset: [pixel size, filename stem]
// Some sizes share the same pixel count (@1x vs @2x naming convention).
const MAC_ICONS: [number, string][] = [
	[16,   "icon_16x16"],
	[32,   "icon_16x16@2x"],
	[32,   "icon_32x32"],
	[64,   "icon_32x32@2x"],
	[128,  "icon_128x128"],
	[256,  "icon_128x128@2x"],
	[256,  "icon_256x256"],
	[512,  "icon_256x256@2x"],
	[512,  "icon_512x512"],
	[1024, "icon_512x512@2x"],
];

// Windows .ico: standard sizes, images embedded as PNG (requires Vista+).
const WIN_SIZES = [16, 24, 32, 48, 64, 128, 256];

/**
 * Builds a valid .ico binary.
 * Modern ICO embeds each image as a PNG blob — supported since Windows Vista.
 * The ICONDIR → ICONDIRENTRY[] → image-data layout is described in:
 * https://learn.microsoft.com/en-us/previous-versions/ms997538(v=msdn.10)
 */
function buildICO(pngBuffers: Buffer[], sizes: number[]): Buffer {
	const count = sizes.length;
	const dirs: Buffer[] = [];
	let imageOffset = 6 + count * 16; // ICONDIR(6) + ICONDIRENTRY(16) * n

	for (let i = 0; i < count; i++) {
		const s = sizes[i];
		const dir = Buffer.alloc(16);
		dir.writeUInt8(s >= 256 ? 0 : s, 0);        // width  (0 encodes 256)
		dir.writeUInt8(s >= 256 ? 0 : s, 1);        // height
		dir.writeUInt8(0, 2);                         // colorCount (0 = truecolor)
		dir.writeUInt8(0, 3);                         // reserved
		dir.writeUInt16LE(1, 4);                      // planes
		dir.writeUInt16LE(32, 6);                     // bitCount
		dir.writeUInt32LE(pngBuffers[i].length, 8);  // image byte length
		dir.writeUInt32LE(imageOffset, 12);           // offset from file start
		dirs.push(dir);
		imageOffset += pngBuffers[i].length;
	}

	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0);      // reserved
	header.writeUInt16LE(1, 2);      // type: 1 = ICO
	header.writeUInt16LE(count, 4);  // number of images

	return Buffer.concat([header, ...dirs, ...pngBuffers]);
}

// ── Launch browser ────────────────────────────────────────────────────────

let browser;
try {
	browser = await chromium.launch({ headless: true });
} catch {
	console.error(
		"Error: Playwright browser not found.\n" +
		"Install it once with:  bunx playwright install chromium\n",
	);
	process.exit(1);
}

const context = await browser.newContext({ deviceScaleFactor: 1 });
const page = await context.newPage();

// Use a canvas so we can measure the actual glyph bounding box and centre it
// precisely — CSS flexbox aligns the line box, not the visual glyph, which
// produces off-centre results for emoji with unequal font-metric padding.
await page.setContent(
	`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; }
  html, body { background: transparent; overflow: hidden; }
  canvas { display: block; }
</style></head>
<body><canvas id="c"></canvas>
<script>
// Called from Playwright for every size. Draws the emoji visually centred.
window.drawIcon = function(emoji, size) {
  const c = document.getElementById('c');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // Start at 85 % of canvas size; reduce if glyph overflows with 6 % padding.
  const pad  = size * 0.06;
  const max  = size - pad * 2;
  let   fs   = size * 0.85;
  ctx.font = fs + 'px serif';
  ctx.textBaseline = 'alphabetic';
  let m = ctx.measureText(emoji);
  const gw0 = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const gh0 = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const scale = Math.min(1, max / Math.max(gw0, gh0));
  if (scale < 1) {
    fs *= scale;
    ctx.font = fs + 'px serif';
    m = ctx.measureText(emoji);
  }

  // Derive centred draw position from *actual* glyph bounds, not line metrics.
  const gw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const gh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const x  = (size - gw) / 2 + m.actualBoundingBoxLeft;   // baseline x
  const y  = (size - gh) / 2 + m.actualBoundingBoxAscent; // baseline y

  ctx.fillText(emoji, x - m.actualBoundingBoxLeft, y);
};
</script>
</body></html>`,
	{ waitUntil: "load" },
);

// Collect all unique pixel sizes across both targets, render each once.
const allSizes = [
	...new Set([...MAC_ICONS.map(([s]) => s), ...WIN_SIZES]),
].sort((a, b) => a - b);

console.log(`Rendering '${EMOJI}' via headless Chromium …`);
const pngCache = new Map<number, Buffer>();

for (const size of allSizes) {
	// Read pixel data directly from the canvas via toDataURL — this preserves
	// the alpha channel correctly. Playwright screenshots blend the canvas onto
	// a white background even with omitBackground: true.
	const dataUrl: string = await page.evaluate(
		([e, s]) => {
			(window as any).drawIcon(e, s);
			return (document.getElementById("c") as HTMLCanvasElement).toDataURL("image/png");
		},
		[EMOJI, size] as [string, number],
	);
	const png = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
	pngCache.set(size, png);
	process.stdout.write(`  ${size}px ✓\n`);
}

await browser.close();

// ── Write macOS iconset ───────────────────────────────────────────────────

mkdirSync(ICONSET_DIR, { recursive: true });
for (const [size, name] of MAC_ICONS) {
	writeFileSync(join(ICONSET_DIR, `${name}.png`), pngCache.get(size)!);
}
console.log(`\nmacOS   → icon.iconset/  (${MAC_ICONS.length} files)`);

// ── Write Windows .ico ────────────────────────────────────────────────────

const ico = buildICO(
	WIN_SIZES.map((s) => pngCache.get(s)!),
	WIN_SIZES,
);
writeFileSync(join(PROJECT_ROOT, "icon.ico"), ico);
console.log(`Windows → icon.ico  (${WIN_SIZES.join(", ")} px)`);
console.log(`Linux   → icon.iconset/icon_512x512.png`);
console.log(`\nDone. Run 'bun start' to pick up the new icon.`);
