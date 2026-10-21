// Rasterizes the SVG diagrams in ../diagrams to crisp PNGs at 2x/3x density.
// Run: node scripts/svg-to-png.mjs
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "..", "diagrams");
const DENSITY = 150; // renders an ~1900px-wide 4K-viewable image from 900px SVGs

const files = readdirSync(DIR).filter(f => f.endsWith(".svg"));
console.log(`Converting ${files.length} SVGs to PNG (density ${DENSITY})`);

for (const f of files) {
  const svg = readFileSync(path.join(DIR, f));
  const outPath = path.join(DIR, f.replace(/\.svg$/, ".png"));
  try {
    const img = sharp(svg, { density: DENSITY })
      .flatten({ background: "#ffffff" })
      .png();
    const meta = await img.metadata();
    await sharp(svg, { density: DENSITY })
      .flatten({ background: "#ffffff" })
      .resize({ width: meta.width * 2, withoutEnlargement: true })
      .png()
      .toFile(outPath);
    const size = (await import("node:fs")).statSync(outPath).size;
    console.log(`  OK  ${f} -> ${path.basename(outPath)} (${Math.round(size / 1024)} KB)`);
  } catch (err) {
    console.error(`  ERR ${f}: ${err.message}`);
  }
}