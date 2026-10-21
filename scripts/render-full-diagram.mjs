// Renders ONE complete architecture diagram (all layers + both lifecycles)
// to SVG/JPG (mermaid.ink) and then a crisp PNG (sharp).
// Run: node scripts/render-full-diagram.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "diagrams");
const NAME = "00-full-architecture";

const API = "https://mermaid.ink";
const MD_FILE = path.join(ROOT, "diagrams", `${NAME}.mermaid`);
const SVG_FILE = path.join(OUT_DIR, `${NAME}.svg`);
const JPG_FILE = path.join(OUT_DIR, `${NAME}.jpg`);
const PNG_FILE = path.join(OUT_DIR, `${NAME}.png`);

const code = `flowchart TB
    subgraph U["1 · USERS (8 roles)"]
        direction LR
        A1["ADMIN"]
        A2["WAREHOUSE"]
        A3["PROVISIONING"]
        A4["FINANCE"]
        A5["LOGISTICS"]
        A6["REVERSE PICKUP"]
        A7["WARRANTY"]
        A8["PWC (view-only)"]
    end

    subgraph G["2 · GATEWAY — src/proxy.ts middleware"]
        direction LR
        G1["Rate limit per IP · 120/min API · 10/min upload"]
        G2["Session verify · sha256 token · 15 min idle · 8 h absolute"]
        G3["Module permission gate per route"]
    end

    subgraph P["3 · APP ROUTER UI — /dashboard modules"]
        direction LR
        P1["Inventory"]
        P2["Warehouse"]
        P3["Provisioning"]
        P4["Finance"]
        P5["Logistics"]
        P6["Reverse Pickup"]
        P7["Warranty"]
        P8["Assigned Assets"]
        P9["Product Master"]
        P10["Vendor Master"]
        P11["Admin"]
    end

    subgraph B["4 · BUSINESS LOGIC (self-authorized)"]
        direction LR
        subgraph SA["Server Actions (21 files)"]
            direction LR
            S1["orders / inventory / warehouse / qc / dc"]
            S2["provisioning / assignment / finance / logistics"]
            S3["reverse-pickup / warranty / auth / two-factor / admin"]
            S4["import-csv / search"]
        end
        subgraph AP["API Routes"]
            direction LR
            R1["export-* (xlsx/csv) ×9"]
            R2["import-csv · import-provisioning · import-reverse-pickup"]
            R3["dc/[id]/pdf (pdfmake) · dc-by-order/[orderId]"]
            R4["pafex/sync · pod-file · pod-url · pods/upload"]
            R5["inventory-lookup · inventory-available · pincode/[code]"]
            R6["products/by-part-no/[partNo] · seed · upload"]
        end
    end

    subgraph D["5 · DOMAIN — src/lib services"]
        direction LR
        L1["auth · permissions · two-factor"]
        L2["sla-utils · cutoff-utils · location-utils"]
        L3["order-sync · order-status · sequence-number"]
        L4["pafex · storage · dc-pdf"]
        L5["Prisma 7 + adapter-pg · pool max 5"]
    end

    subgraph DB["6 · POSTGRESQL (Supabase) — 17 models"]
        direction LR
        DB1["users · sessions · two_factor_recovery_codes"]
        DB2["orders · assets · dockets · delivery_challans · dc_items"]
        DB3["inventory_items · assignment_records · dropdown_options"]
        DB4["delivery_records · reverse_pickup_requests · rto_records"]
        DB5["warehouses · vendor_master · product_master"]
        DB6["pafex_docket_checks"]
    end

    subgraph X["7 · STORAGE + EXTERNAL SERVICES"]
        direction LR
        X1["Supabase pod_upload bucket / local uploads/ volume"]
        X2["Pafex Courier API · tracking + POD"]
        X3["Pincode API"]
    end

    subgraph OW["ORDER LIFECYCLE (33 states)"]
        direction LR
        O1["ORDER_PLACED"] --> O2["ALLOCATED"] --> O3["IN_PROVISIONING"]
        O3 --> O4["DC_GENERATED"] --> O5["DISPATCHED"] --> O6["DELIVERED"]
        O6 --> O7["INVOICED"] --> O8["WARRANTY_UPDATED"]
        O5 -.->|delivery fails| O9["RTO chain → back to AVAILABLE stock"]
    end

    subgraph RW["REVERSE PICKUP LIFECYCLE (35 states)"]
        direction LR
        Q1["REQUESTED"] --> Q2["PARTNER"] --> Q3["DOCKET"] --> Q4["PICKED_UP"]
        Q4 --> Q5["WAREHOUSE"] --> Q6["QC 1+2"] --> Q7["BLANCO ×3"] --> Q8["COMPLETED"]
        Q6 -.->|QC fail| Q9["HP case → repair → QC"]
    end

    U --> G
    G --> P
    G --> B
    P --> B
    B --> D
    D --> DB
    B --> X
    X -.-> DB
    DB --> OW
    DB --> RW
`;

function base64url(str) {
  return Buffer.from(str, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function fetchRender(kind) {
  const res = await fetch(`${API}/${kind}/${base64url(code)}`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${kind} render failed: HTTP ${res.status} ${await res.text()}`);
  return kind === "svg" ? res.text() : Buffer.from(await res.arrayBuffer());
}

const svgText = await fetchRender("svg");
const svg = Buffer.from(svgText, "utf8");
writeFileSync(SVG_FILE, svg);
writeFileSync(MD_FILE, code);
writeFileSync(JPG_FILE, await fetchRender("img"));

const meta = await sharp(svg, { density: 120 }).metadata();
const target = { width: Math.min(2600, meta.width * 2) };
await sharp(svg, { density: 120 })
  .resize({ ...target, withoutEnlargement: false })
  .flatten({ background: "#ffffff" })
  .png()
  .toFile(PNG_FILE);

console.log(`SVG  -> ${SVG_FILE}`);
console.log(`JPG  -> ${JPG_FILE}`);
console.log(`PNG  -> ${PNG_FILE}`);
const info = await sharp(PNG_FILE).metadata();
console.log(`Size -> ${info.width}x${info.height}`);