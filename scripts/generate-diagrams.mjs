// Renders every ```mermaid block in ../ARCHITECTURE.md to SVG + JPEG via the
// mermaid.ink render service and builds a single self-contained ARCHITECTURE.html
// with all the SVGs inlined, so the visual opens offline in any browser.
//
// Run: node scripts/generate-diagrams.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MD = path.join(ROOT, "ARCHITECTURE.md");
const OUT_DIR = path.join(ROOT, "diagrams");
const HTML_OUT = path.join(ROOT, "ARCHITECTURE.html");

const API = "https://mermaid.ink";
// HTML page is optional — set HTML=1 to also build ARCHITECTURE.html.
const WITH_HTML = process.env.HTML === "1";

function slugify(title) {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "diagram";
}

// Split the markdown and pair each mermaid block with the nearest preceding
// heading so file names and the HTML page stay readable.
function extractDiagrams() {
  const lines = readFileSync(MD, "utf8").split("\n");
  const diagrams = [];
  let currentTitle = "Architecture";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^#{2,3}\s+(.+)$/);
    if (heading) {
      currentTitle = heading[1].replace(/^#+\s*/, "").trim();
      continue;
    }
    if (line.trim() !== "```mermaid") continue;
    const block = [];
    i++;
    while (i < lines.length && lines[i].trim() !== "```") {
      block.push(lines[i]);
      i++;
    }
    diagrams.push({
      title: currentTitle,
      code: block.join("\n").replace(/&lbrack;/g, "[").replace(/&rbrack;/g, "]"),
    });
  }
  return diagrams;
}

function base64url(str) {
  return Buffer.from(str, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function render(kind, code, outPath) {
  const b64 = base64url(code);
  const res = await fetch(`${API}/${kind}/${b64}`, {
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`${kind} render failed: HTTP ${res.status}`);
  const data = kind === "svg" ? await res.text() : Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, data);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const diagrams = extractDiagrams();
  console.log(`Found ${diagrams.length} mermaid blocks`);

  const items = [];
  for (let i = 0; i < diagrams.length; i++) {
    const d = diagrams[i];
    const slug = slugify(d.title);
    const svgPath = path.join(OUT_DIR, `${String(i + 1).padStart(2, "0")}-${slug}.svg`);
    const jpgPath = path.join(OUT_DIR, `${String(i + 1).padStart(2, "0")}-${slug}.jpg`);
    try {
      await render("svg", d.code, svgPath);
      await render("img", d.code, jpgPath);
      console.log(`  OK  ${d.title}  (${d.code.split("\n").length} lines)`);
      items.push({
        title: d.title,
        svg: readFileSync(svgPath, "utf8"),
        jpg: jpgPath,
      });
    } catch (err) {
      console.error(`  ERR ${d.title}: ${err.message}`);
      items.push({
        title: d.title,
        svg: null,
        error: err.message,
      });
    }
  }

  const body = items
    .map(item => {
      if (!item.svg) {
        return `<section><h2>${escapeHtml(item.title)}</h2><p class="err">Render failed: ${escapeHtml(item.error)}</p><pre>${escapeHtml(diagrams[items.indexOf(item)].code)}</pre></section>`;
      }
      return `<section><h2>${escapeHtml(item.title)}</h2>${item.svg}</section>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Asset Delivery System — Architecture Diagrams</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; background: #f6f7f9; color: #111; }
  header { background: #0f172a; color: #fff; padding: 24px 32px; }
  header h1 { margin: 0 0 4px; font-size: 22px; }
  header p { margin: 0; color: #94a3b8; font-size: 14px; }
  main { max-width: 1200px; margin: 0 auto; padding: 24px 32px 64px; }
  section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin: 24px 0; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  section h2 { margin: 0 0 4px; font-size: 18px; color: #0f172a; }
  section svg { width: 100%; height: auto; display: block; }
  .err { color: #b91c1c; }
  pre { background: #f1f5f9; padding: 12px; border-radius: 8px; overflow: auto; font-size: 12px; }
  footer { text-align: center; color: #64748b; font-size: 13px; padding: 24px; }
  @media print { body { background: #fff; } section { box-shadow: none; break-inside: avoid; } }
</style>
</head>
<body>
<header>
  <h1>Asset Delivery System — Architecture Diagrams</h1>
  <p>Generated from ARCHITECTURE.md &middot; ${items.length} diagrams</p>
</header>
<main>
${body}
</main>
<footer>Asset Delivery System (PWC / HP) &mdash; Next.js 16 &middot; React 19 &middot; Prisma &middot; PostgreSQL &middot; Supabase &middot; Pafex</footer>
</body>
</html>
`;
  if (WITH_HTML) {
    writeFileSync(HTML_OUT, html);
  }
  console.log(`\nWrote ${diagrams.length} diagram files to ${OUT_DIR}`);
  if (WITH_HTML) console.log(`Wrote ${HTML_OUT}`);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});