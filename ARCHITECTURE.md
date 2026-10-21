# Asset Delivery System — Architecture

PWC / HP asset delivery and reverse-pickup platform. Next.js 16 (App Router) + React 19 +
TypeScript + Tailwind v4 + Prisma 7 on PostgreSQL (Supabase), with Pafex courier tracking
and Supabase Storage for proof-of-delivery documents.

---

## 1. System Context (High Level)

```mermaid
graph TB
    subgraph Users["Users (role-based)"]
        WH[Warehouse]
        PV[Provisioning]
        FI[Finance]
        LG[Logistics]
        RP[Reverse Pickup]
        WR[Warranty]
        AD[Admin]
        PW[PWC - view only]
    end

    subgraph App["asset-delivery-system (Next.js 16 standalone)"]
        UI[App Router UI + Server Actions]
        API[API Routes]
        MW[proxy.ts Middleware]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL / Supabase via session pooler)]
        SUPA[(Supabase Storage pod_upload bucket)]
        VOL[(Local uploads/ volume)]
    end

    subgraph Ext["External Services"]
        PAFEX[Pafex Courier API - tracking + POD]
        PIN[Pincode API]
    end

    Users --> MW --> UI
    MW --> API
    UI --> PG
    API --> PG
    API --> SUPA
    API --> VOL
    API --> PAFEX
    UI --> PIN
```

## 2. Application Layer (Next.js App Router)

```mermaid
graph TB
    subgraph Browser
        RSC[React Server Components + Client Components]
    end

    subgraph Request["Request Pipeline"]
        MW["proxy.ts (middleware)<br/>rate limit (API 120/min, upload 10/min)<br/>session validate + idle/absolute timeout<br/>module permission gate"]
    end

    subgraph Pages["src/app/dashboard/* (11 modules)"]
        P1[inventory]
        P2[warehouse]
        P3[provisioning]
        P4[finance]
        P5[logistics]
        P6[reverse-pickup]
        P7[warranty]
        P8[assigned-assets]
        P9[product-master]
        P10[vendor-master]
        P11[admin]
    end

    subgraph Actions["Server Actions (writes, self-authorized)"]
        A1[orders / inventory / warehouse / qc]
        A2[provisioning / assignment]
        A3[finance / dc / logistics]
        A4[reverse-pickup / warranty]
        A5[auth / two-factor / admin / logout]
        A6[import-csv / search]
    end

    subgraph APIroutes["API Routes (route handlers)"]
        E1["export-* (xlsx/csv) - 9 endpoints"]
        I1["import-csv / import-provisioning / import-reverse-pickup"]
        D1["dc/[id]/pdf (pdfmake)"]
        F1["pafex/sync (cron / api-key)"]
        U1["pod-file / pod-url / pods/upload"]
        L1[inventory-lookup / inventory-available]
        P1r["pincode/[pincode]"]
        PM["products/by-part-no/[partNo]"]
        S1["seed + upload"]
    end

    subgraph Lib["src/lib (domain services)"]
        L1a[auth.ts - permissions.ts - two-factor.ts]
        L2a[prisma.ts - sequence-number.ts]
        L3a[order-sync.ts - order-status.ts]
        L4a[pafex.ts - storage.ts - dc-pdf.ts]
        L5a[sla-utils.ts - cutoff-utils.ts - location-utils.ts]
    end

    RSC --> MW
    MW --> Pages
    Pages --> Actions
    MW --> APIroutes
    Actions --> Lib
    APIroutes --> Lib
```

## 3. Data Model (Core ERD)

```mermaid
erDiagram
    User ||--o{ Session : has
    User ||--o{ TwoFactorRecoveryCode : has

    Order ||--o{ Asset : contains
    Order ||--o{ Docket : ships
    Order ||--o{ DeliveryChallan : billed
    Order ||--o| RtoRecord : RTO

    InventoryItem ||--o{ Asset : fulfills
    InventoryItem ||--o{ AssignmentRecord : history
    InventoryItem ||--o{ ReversePickupRequest : returned

    Docket }o--|| Order : belongs
    PafexDocketCheck ||--|| Docket : sync-cache

    Warehouse ||--o{ DeliveryChallan : issues
    Warehouse ||--o{ RtoRecord : receives

    ReversePickupRequest ||--o{ DeliveryChallan : DC
    DeliveryChallan ||--o{ DeliveryChallanItem : lines
```

## 4. Order Lifecycle (Forward Flow)

```mermaid
stateDiagram-v2
    [*] --> ORDER_PLACED
    ORDER_PLACED --> ALLOCATED : warehouse allocates stock
    ALLOCATED --> IN_PROVISIONING : send to provisioning
    IN_PROVISIONING --> DOCKET_REQUESTED
    DOCKET_REQUESTED --> DOCKET_ASSIGNED
    DOCKET_ASSIGNED --> DC_REQUESTED
    DC_REQUESTED --> DC_GENERATED : finance
    DC_GENERATED --> PACKED_AND_LABELLED
    PACKED_AND_LABELLED --> EWAY_BILL_REQUESTED
    EWAY_BILL_REQUESTED --> EWAY_BILL_GENERATED
    EWAY_BILL_GENERATED --> DISPATCHED
    DISPATCHED --> DELIVERED : Pafex tracking sync
    DELIVERED --> DELIVERY_CONFIRMED
    DELIVERY_CONFIRMED --> INVOICED
    INVOICED --> WARRANTY_UPDATED
    DISPATCHED --> RTO : delivery failed
    RTO --> RTO_DC_REQUESTED
    RTO_DC_REQUESTED --> RTO_DC_GENERATED
    RTO_DC_GENERATED --> RTO_EWAY_BILL_REQUESTED
    RTO_EWAY_BILL_REQUESTED --> RTO_EWAY_BILL_GENERATED
    RTO_EWAY_BILL_GENERATED --> RTO_IN_TRANSIT
    RTO_IN_TRANSIT --> RTO_DELIVERED_TO_WAREHOUSE
    RTO_DELIVERED_TO_WAREHOUSE --> [*] : back to AVAILABLE stock
```

## 5. Reverse Pickup Lifecycle

```mermaid
stateDiagram-v2
    [*] --> REQUESTED
    REQUESTED --> PARTNER_ASSIGNED
    PARTNER_ASSIGNED --> DOCKET_REQUESTED
    DOCKET_REQUESTED --> DOCKET_ASSIGNED
    DOCKET_ASSIGNED --> PICKED_UP
    PICKED_UP --> IN_TRANSIT
    IN_TRANSIT --> RECEIVED_AT_WAREHOUSE
    RECEIVED_AT_WAREHOUSE --> QC_CLEANED : QC level 1 hardware
    QC_CLEANED --> QC_COMPLETED : QC level 2 software
    QC_COMPLETED --> BLANCO_CLEARED
    BLANCO_CLEARED --> BLANCO_PURGED
    BLANCO_PURGED --> BLANCO_CERTIFIED
    BLANCO_CERTIFIED --> COMPLETED
    QC_COMPLETED --> CASE_LOGGED_WITH_HP : QC failed
    CASE_LOGGED_WITH_HP --> QC_COMPLETED : repaired
```

## 6. Pafex Tracking + POD Sync

```mermaid
sequenceDiagram
    participant CRON as Cron / Logistics user
    participant Route as /api/pafex/sync
    participant DB as PostgreSQL
    participant PX as Pafex API
    participant ST as Supabase Storage

    CRON->>Route: POST ?limit=&dryRun= (x-api-key)
    Route->>Route: auth (api-key OR session logistics/warehouse)
    Route->>DB: loadCandidates() - non-delivered dockets
    loop concurrency 4
        Route->>PX: fetchTracking(docketNo)
        PX-->>Route: events[]
        Route->>DB: upsert PafexDocketCheck
        alt any event = delivered
            Route->>DB: markItemsDelivered(dates)
            Route->>PX: downloadPod(pod_image)
            Route->>ST: saveFile pod/{file}
            Route->>DB: set podDocumentUrl
        else in_transit
            Route->>DB: markItemsInTransit()
        end
    end
    Route-->>CRON: JSON summary
```

## 7. Auth & Security Flow

```mermaid
flowchart TD
    Start([Request]) --> IsAPI{/api/*?}
    IsAPI -->|yes| RL[Rate limit by IP]
    RL --> OK1[proceed]
    IsAPI -->|no| HasCookie{devit_session cookie?}
    HasCookie -->|no| Login[redirect /]
    HasCookie -->|yes| Verify[sha256 hash to DB Session lookup]
    Verify --> Valid{active + idle + 8h absolute?}
    Valid -->|no| Clear[delete cookie]
    Valid -->|yes| Perm{module permission canView?}
    Perm -->|no| Dash[redirect /dashboard]
    Perm -->|yes| Serve[Serve page]
```

## 8. Deployment Architecture (Docker)

```mermaid
graph LR
    subgraph Build["Multi-stage Dockerfile"]
        D[deps: npm ci] --> B[builder: prisma generate + next build]
        B --> M[migrator: prisma migrate deploy]
        B --> R[runner: node server.js non-root]
    end
    MG[asset-delivery-migrate one-shot] -->|completed| AP[asset-delivery app 8001:3000]
    VOL[(uploads volume)] --- AP
    AP --> PG[(Supabase Postgres pooler)]
    AP --> ST[(Supabase pod_upload bucket)]
    AP --> PX[Pafex API]
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, `output: standalone`) |
| UI | React 19, Tailwind CSS v4, Base UI, lucide-react, shadcn |
| Language | TypeScript 5 |
| ORM / DB | Prisma 7 + `@prisma/adapter-pg`, PostgreSQL (Supabase pooler) |
| Object storage | Supabase Storage (`pod_upload` bucket) or local `uploads/` |
| Auth | Custom sessions (sha256-hashed tokens), bcryptjs, otplib TOTP 2FA |
| Documents | pdfmake (DC PDF), xlsx + csv-parse (imports/exports) |
| Courier | Pafex HTTP API (tracking + POD download) |
| Deploy | Docker multi-stage, docker-compose, nginx |

## Modules (role-gated)

| Module | Path | Roles with access |
|--------|------|-------------------|
| Inventory | `/dashboard/inventory` | ADMIN, WAREHOUSE, PWC (view) |
| Assigned Assets | `/dashboard/assigned-assets` | ADMIN, LOGISTICS (view), PWC |
| Warehouse | `/dashboard/warehouse` | ADMIN, WAREHOUSE, PWC |
| Provisioning | `/dashboard/provisioning` | ADMIN, PROVISIONING, PWC |
| Finance | `/dashboard/finance` | ADMIN, FINANCE, PWC |
| Logistics | `/dashboard/logistics` | ADMIN, LOGISTICS, PWC |
| Reverse Pickup | `/dashboard/reverse-pickup` | ADMIN, REVERSE_PICKUP, PWC |
| Warranty | `/dashboard/warranty` | ADMIN, WARRANTY, PWC |
| Product Master | `/dashboard/product-master` | ADMIN, PWC |
| Vendor Master | `/dashboard/vendor-master` | ADMIN, PWC |
| Admin | `/dashboard/admin` | ADMIN |

## Core Data Models (17)

| Model | Purpose |
|-------|---------|
| User | Accounts, role, JSON permissions, 2FA fields |
| Session | Hashed session tokens, idle + absolute expiry |
| TwoFactorRecoveryCode | Hashed 2FA recovery codes |
| Order | Delivery order + OrderStatus workflow |
| RtoRecord | Return-to-origin receipt per order |
| InventoryItem | Central asset record (serial, assignment, SLA, QC, POD) |
| AssignmentRecord | Assignment history per asset |
| DropdownOption | Managed dropdown values (entity/purpose/imageType) |
| Asset | Order-to-inventory link, provisioning status |
| DeliveryRecord | Imported delivery sheet rows |
| ReversePickupRequest | Reverse pickup workflow + Blancco/QC + HP case |
| VendorMaster | Vendor records (GRN) |
| ProductMaster | Make/model/HSN/GST product catalog |
| Docket | Shipment docket + courier tracking |
| PafexDocketCheck | Sync cache to avoid re-querying unknown dockets |
| Warehouse | Warehouse locations |
| DeliveryChallan | DC header (finance) |
| DeliveryChallanItem | DC line items |

## Enums

- **OrderStatus** (33 values): `ORDER_PLACED`, `ALLOCATED`, `IN_PROVISIONING`, `DOCKET_REQUESTED`, `DOCKET_ASSIGNED`, `DC_REQUESTED`, `DC_GENERATED`, `PACKED_AND_LABELLED`, `EWAY_BILL_REQUESTED`, `EWAY_BILL_GENERATED`, `DISPATCHED`, `DELIVERED`, `RTO*`, `DELIVERY_CONFIRMED`, `INVOICED`, `WARRANTY_UPDATED`, `CANCELLED`.
- **ReversePickupStatus** (35 values): `REQUESTED` … `QC_CLEANED` … `BLANCO_CERTIFIED`, `COMPLETED`, plus error/parking states (`CASE_LOGGED_WITH_HP`, `RTO_CASE`, `LOST_DEVICE`, `ON_HOLD`, …).
- **InventoryStatus**: `NEW`, `AVAILABLE`, `QC_PENDING`, `ALLOCATED`, `DEFECTIVE`, `RETIRED`.
- **UserRole**: `ADMIN`, `WAREHOUSE`, `PROVISIONING`, `FINANCE`, `LOGISTICS`, `WARRANTY`, `REVERSE_PICKUP`, `PWC`.

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/export-{inventory,warehouse,finance,logistics,reverse-pickup,provisioning,cases,pods,assigned-assets}` | GET | Export data (xlsx/csv) |
| `/api/import-csv`, `/api/import-provisioning`, `/api/import-reverse-pickup` | POST | Bulk imports |
| `/api/dc/[id]/pdf` | GET | Generate Delivery Challan PDF |
| `/api/dc/dc-by-order/[orderId]` | GET | DC lookup by order |
| `/api/pafex/sync` | POST | Pafex tracking + POD sync (api-key or session) |
| `/api/pod-file`, `/api/pod-url`, `/api/pods/upload` | GET/POST | POD file read/URL/upload |
| `/api/inventory-lookup`, `/api/inventory-available` | GET | Inventory search |
| `/api/pincode/[pincode]` | GET | Pincode lookup |
| `/api/products/by-part-no/[partNo]` | GET | Product master lookup |
| `/api/auth/clear-session`, `/api/seed`, `/api/upload` | POST/GET | Utility |

## Security

- Session cookie `devit_session`: httpOnly, SameSite=lax, secure-flag optional; token stored **sha256-hashed** in DB.
- Idle timeout 15 min (slidden, DB-write only near expiry) + 8h absolute timeout.
- 2FA (TOTP via otplib) with signed `devit_2fa_pending` cookie (HMAC, 5-min TTL) and hashed recovery codes.
- `proxy.ts` middleware enforces auth + module permissions per route prefix and per-IP rate limits.
- Server Actions self-authorize via `requireAuth()` + `requirePermission()` (public POST endpoints).
- Security headers set in `next.config.ts` (HSTS, X-Frame-Options DENY, nosniff, etc.).
- Path traversal guard on all POD storage paths (`assertSafePodPath`).
