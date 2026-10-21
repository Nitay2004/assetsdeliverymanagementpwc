// Renders ONE runtime / request-flow diagram: how requests enter, which
// services get called, and which queries hit Postgres / Pafex / storage.
// Run: node scripts/render-runtime-diagram.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "diagrams");
const NAME = "00-runtime-flow";
const API = "https://mermaid.ink";

const code = `flowchart TB
    subgraph CLIENT["CLIENT"]
        direction LR
        C1["User opens a page<br/>GET /dashboard/module"]
        C2["User clicks a button<br/>Server Action POST"]
        C3["Download export / PDF<br/>GET /api/export-* / dc pdf"]
        C4["Cron job<br/>POST /api/pafex/sync"]
    end

    subgraph INFRA["STAGING INFRASTRUCTURE — 3 servers"]
        direction LR
        INF1["STGProxyServer1<br/>10.199.206.98<br/>nginx reverse proxy (deploy/nginx.conf)"]
        INF2["STAG-APP1<br/>10.199.206.100<br/>Docker Compose: app 8001→3000 + migrate one-shot<br/>code /opt/asset-delivery-system · uploads volume"]
        INF3["STAG-DB1<br/>10.199.206.99<br/>PostgreSQL 16 container :5433<br/>volume asset-delivery-db-data"]
    end

    subgraph CRON["CRON JOBS — crontab on STAG-APP1"]
        direction LR
        K1["every N minutes → POST http://localhost:8001/api/pafex/sync<br/>header x-api-key = PAFEX_SYNC_API_KEY<br/>pulls Pafex tracking + downloads POD + updates DB"]
    end

    subgraph CD["CI / CD — GitHub Actions (self-hosted runner on STAG-APP1)"]
        direction LR
        D1["git push → main"]
        D2["quality gate: npm ci → tsc --noEmit → lint"]
        D3["sync code → /opt/asset-delivery-system"]
        D4["docker compose up -d --build (migrate deploy + app)"]
        D5["health check HTTP 200"]
    end

    subgraph MID["MIDDLEWARE — src/proxy.ts (runs on every request)"]
        direction LR
        M1["api/* → rate limit per IP (120/min · upload 10/min)"]
        M2["Session: sha256(cookie) → SELECT sessions JOIN users"]
        M3["Timeouts: idle 15 min · absolute 8 h → delete + redirect /"]
        M4["Permission gate: resolveModuleFromPath + canViewModule"]
    end

    subgraph LOGIN["LOGIN (only at /)"]
        direction LR
        W1["bcrypt compare users.password_hash"]
        W2["TOTP 2FA verify (otplib) + recovery codes"]
        W3["INSERT sessions + SET devit_session cookie"]
    end

    subgraph PAGES["SERVER COMPONENTS — dashboard pages"]
        direction LR
        P1["Page load runs ~7 aggregate queries"]
        P2["Table read with URL filters ?search ?page ?status"]
        P3["RSC fetches data directly via Prisma"]
    end

    subgraph ACT["SERVER ACTIONS — self-authorized writes"]
        direction LR
        A1["getSession() → SELECT sessions"]
        A2["requirePermission(role, module, action)"]
        A3["domain service runs business logic"]
        A4["INSERT / UPDATE / DELETE → revalidatePath"]
    end

    subgraph API["API ROUTES — route handlers"]
        direction LR
        R1["export-* (9): SELECT → xlsx/csv file"]
        R2["import-* (3): parse csv/xlsx → INSERT rows"]
        R3["dc/[id]/pdf: SELECT dc + items → pdfmake PDF"]
        R4["pafex/sync: background sync job"]
        R5["pods/upload · pod-url: saveFile → storage"]
        R6["pincode · products · inventory-lookup: SELECT"]
    end

    subgraph SVC["DOMAIN SERVICES — src/lib"]
        direction LR
        S1["auth · permissions · two-factor"]
        S2["order-sync: order status mirrored onto inventory"]
        S3["sla-utils · cutoff-utils · location-utils"]
        S4["pafex client · storage (supabase/local)"]
    end

    subgraph PGHOST["POSTGRESQL — STAG-DB1 (10.199.206.99:5433)"]
        direction LR
        G0["postgres:16-alpine container · user/db=assetdelivery"]
        G1["users · sessions · two_factor_recovery_codes"]
        G2["orders · assets · dockets · delivery_challans + items"]
        G3["inventory_items · assignment_records · dropdown_options"]
        G4["reverse_pickup_requests · rto_records · warehouses"]
        G5["product_master · vendor_master · pafex_docket_checks"]
    end

    subgraph OUT["OUTBOUND CALLS"]
        direction LR
        O1["Pafex Tracking API + POD download"]
        O2["Supabase Storage pod_upload / local uploads/"]
        O3["Pincode API"]
    end

    subgraph SYNC["PAFEX SYNC — one run"]
        direction LR
        Y1["SELECT candidate dockets (skip cooling-down set)"]
        Y2["GET Pafex tracking (4 concurrent)"]
        Y3["UPSERT pafex_docket_checks"]
        Y4["delivered → UPDATE inventory + outward dates; in_transit → status"]
        Y5["download POD → upload storage → UPDATE pod_document_url"]
    end

    subgraph DCGEN["DC / FINANCE generate"]
        direction LR
        Z1["UPDATE order → DC_GENERATED"]
        Z2["INSERT delivery_challans + items"]
        Z3["order-sync pushes status to inventory trackingStatus"]
    end

    CLIENT --> INF1
    INF1 --> INF2
    INF2 --> MID
    INF2 --- INF3
    C1 --> INF1
    C2 --> INF1
    C3 --> INF1
    C4 --> INF1
    MID --no session/expired--> LOGIN
    LOGIN --> MID
    MID --page path--> PAGES
    MID --> ACT
    MID --/api/*--> API
    API --> SVC
    ACT --> SVC
    PAGES --> SVC
    SVC --> PGHOST
    API --> PGHOST
    API --> OUT
    SYNC --> API
    SYNC --> PGHOST
    SYNC --> OUT
    DCGEN --> PGHOST
    DCGEN --> SVC
    K1 --> INF2
    K1 --> API
    D1 --> D2
    D2 --> D3
    D3 --> D4
    D4 --> D5
    D5 --> INF2
    OUT --> O1
    OUT --> O2
    OUT --> O3
`;

function base64url(str) {
  return Buffer.from(str, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function fetchRender(kind) {
  const res = await fetch(`${API}/${kind}/${base64url(code)}`, {
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`${kind} render failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return kind === "svg" ? Buffer.from(await res.text(), "utf8") : Buffer.from(await res.arrayBuffer());
}

const svg = await fetchRender("svg");
writeFileSync(path.join(OUT_DIR, `${NAME}.svg`), svg);
writeFileSync(path.join(OUT_DIR, `${NAME}.mermaid`), code);
writeFileSync(path.join(OUT_DIR, `${NAME}.jpg`), await fetchRender("img"));

const meta = await sharp(svg, { density: 110 }).metadata();
const width = Math.min(3000, meta.width * 2);
await sharp(svg, { density: 110 })
  .resize({ width })
  .flatten({ background: "#ffffff" })
  .png()
  .toFile(path.join(OUT_DIR, `${NAME}.png`));

const info = await sharp(path.join(OUT_DIR, `${NAME}.png`)).metadata();
console.log(`SVG/JPG/PNG -> diagrams/${NAME}.*`);
console.log(`PNG ${info.width}x${info.height}`);