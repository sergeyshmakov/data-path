// Rasterise an SVG into a PNG the site needs.
//
// Social cards have to be a PNG because no crawler renders SVG. Generating the
// card from an SVG source committed alongside it means the share card, the
// favicon and the logo cannot drift apart from each other or from the site.
//
// sharp is a devDependency of the docs build for exactly this.
//
//   node scripts/render-png.mjs <input.svg> <output.png> <width> [height]
//
// With no height the SVG's own aspect ratio is kept.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [, , input, output, rawWidth, rawHeight] = process.argv;

if (!input || !output || !rawWidth) {
	console.error(
		"usage: node scripts/render-png.mjs <input.svg> <output.png> <width> [height]",
	);
	process.exit(2);
}

function dimension(raw, label) {
	const value = Number.parseInt(raw, 10);
	if (!Number.isInteger(value) || value < 16 || value > 4096) {
		console.error(
			`refusing ${label} ${raw}: expected an integer from 16 to 4096`,
		);
		process.exit(2);
	}
	return value;
}

const width = dimension(rawWidth, "width");
const height =
	rawHeight === undefined ? undefined : dimension(rawHeight, "height");

const svg = await readFile(path.resolve(input));

// The viewBox is authored in its own units, so sharp has to be told to
// rasterise at the target resolution rather than at the nominal one and upscale.
// `density` is relative to 72dpi against the SVG's intrinsic width; without it
// the output is a blurred small render stretched to size.
const intrinsic = await sharp(svg).metadata();
const density = Math.min(2400, (width / (intrinsic.width || width)) * 72);

const png = await sharp(svg, { density })
	.resize(width, height, {
		fit: height === undefined ? "cover" : "contain",
		background: { r: 0, g: 0, b: 0, alpha: 0 },
	})
	.png({ compressionLevel: 9 })
	.toBuffer();

await writeFile(path.resolve(output), png);

const rendered = await sharp(png).metadata();
console.log(
	`${output}: ${rendered.width}x${rendered.height}, ${png.length} bytes`,
);
