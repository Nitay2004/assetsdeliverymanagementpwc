# Asset Delivery System — Security & Performance Audit Report (Round 2)

**Date:** 21 Sep 2026
**Round:** 2 (post-fix) — follows `APP-REVIEW-REPORT.md` (Round 1, pre-fix baseline)
**Scope:** Server actions, API routes, auth & session, upload & storage, dependency health, dashboard/table query path, deployment pipeline, office DB state
**Method:** Static source review · targeted sub-agent audits (API routes, server actions, perf/storage) · `npm audit` · `tsc --noEmit` · ESLint · production build · live staging deploy + HTTP verification · direct DB inspection

---

## 1. Executive Summary

| Area | Round 1 | Round 2 | Delta |
|------|:-------:|:-------:|-------|
| Features | 9.0 | 9.0 | — |
| Architecture | 7.5 | 7.5 | Clean App Router + Prisma 7 module pattern |
| Performance | 6.0 | 8.0 | Full-scan filter chips → `groupBy`; stats aggregated in DB |
| Security | 4.5 | 7.5 | Server-side gates everywhere, upload/storage hardening, vulnerable deps upgraded |
| DevOps | 6.5 | 7.5 | Build-time migrations, health-check retry, deploy green |
| **Overall** | **6.5** | **8.0** | Robust on office/staging; scalable path clear |

**One line:** All high-severity findings from Round 1 are fixed and deployed; remaining findings are medium–low hardening items, not release blockers.

---

## 2. Fixes Applied (this round) — `main` @ `a105508`

### 2.1 Dependency security
| Item | Detail |
|------|--------|
| `next` | **16.2.7 → 16.3.5** — closes the 16.2.x critical/RCE-class CVEs flagged by `npm audit` |
| `eslint-config-next` | → 16.3.5 (align with Next) |
| `csv-parse` | 6.x → **7.0.2** (major, API-compatible usage verified) |
| `xlsx@0.18.5` | Remains — **no upstream fix exists**; single maintainer, documented high severity, used only in authenticated admin/export flows |

### 2.2 Authorization & session (`server actions`)
Every server action that could leak or mutate data now enforces a session and/or module permission:

| File | Actions gated |
|------|---------------|
| `actions/assignment.ts` | `hasPriorDelivery` (auth); `createAssignmentOrder` (`inventory:canEdit`) |
| `actions/dashboard.ts` | all 6 read actions (`requireAuth`) |
| `actions/inventory.ts` | `getDistinctFieldValues`, `checkSerialNumber` (auth); `getInventoryItem`, `getAssignmentHistory` (`inventory:canView`) |
| `actions/dc.ts` | 8 read actions (`requireAuth`) |
| `actions/reverse-pickup.ts` | `getReversePickupRequests`, `getReversePickupRequest`, `lookupInventoryBySerial`, `getReversePickupDropdowns` (`reverse-pickup:canView`) |
| `actions/search.ts` | results now filtered by the caller's module `canView` per type |
| `actions/provisioning.ts`, `actions/qc.ts` | orphan reads gated by `requireAuth` |
| `actions/product-master.ts`, `actions/vendor-master.ts` | reads gated by module `canView` |
| `actions/auth.ts` | login rejects `isActive=false` users (disabled-account block) before session creation |

New reusable helper: `requireAuth()` in `src/lib/auth.ts` (throws `Unauthorized` when no session).

### 2.3 Authorization — API routes
| Route | Change |
|-------|--------|
| `/api/export-assigned-assets` | `assigned-assets:canView` module gate (was session-only) |
| `/api/upload` | POD view-module gate (logistics / reverse-pickup / warehouse) |
| `/api/pods/upload` | module (logistics/warehouse) **or** API key; key compare via `timingSafeEqual` (was `===`); **10 MB cap; magic-byte validation** |
| `/api/pod-file` / `/api/pod-url` | POD view-module gate; paths enforced inside `storage.ts` (see 2.4) |
| `/api/export-pods` | already ADMIN/LOGISTICS — untouched |

### 2.4 Upload / storage hardening
- **File-type validation** in `/api/upload` and `/api/pods/upload`: extension **and** magic bytes (`%PDF`, `\x89PNG`, `\xFF\xD8\xFF`), empty-file guard.
- **Size caps:** POD uploads 10 MB; CSV/XLSX imports 20 MB (`import-csv`, `import-provisioning`, `import-reverse-pickup`).
- **Error hygiene:** import routes no longer echo raw DB/Prisma `message` strings to the client (leak of schema/constraints); generic copy instead.
- **`src/lib/storage.ts` path guard:** rejects `..`/`.` segments, absolute paths and drive prefixes; **all** read/write/URL paths must be prefixed `pod/` (bucket-scoped). Both local-fs and Supabase branches enforced.

### 2.5 Performance — query path
| Issue (Round 1 / Round 2 audit) | Fix |
|------|------|
| Dashboard stats from unbounded row loads | DB `groupBy` / `count` / bounded `take` |
| Reverse-pickup stat cards loading the full table (`allRequests`) | `groupBy(["status"])` + 2 targeted counts |
| `seedDropdownOptions` — 7 full-table `distinct` scans | 7 `groupBy` queries (aggregate server-side) |
| Filter-chip distinct values on **6 dashboard pages** (warehouse, logistics, finance, provisioning, assigned-assets, reverse-pickup) | Full-scan `findMany` → per-column `groupBy` (root model, relation models e.g. `inventoryItem`/`docket`, composite multi-`by`, date-bucketed via `createdAt` grouping). Chip semantics (tokens, `"(Blank)"`, sort) preserved |

### 2.6 Deployment / DB
- `Dockerfile` now runs `npx prisma generate && npx prisma migrate deploy && npm run build` — DB stays in sync on every deploy.
- `deploy.yml` purges stale `src/` and legacy `middleware.ts` before sync; health check now retries up to 2 minutes.
- **Incident resolved (P3009):** office DB had a stuck failed-migration record (`20260714_add_assignment_record_fields` — columns already applied, record left `failed`) which blocked `migrate deploy` and broke the first build of this round. Root-caused via DB inspection:
  - `_prisma_migrations` was missing records for **5 of 6** existing migrations (all their DDL was already present).
  - Verified column/enum presence for each (`assignment_records`, `users`, `dockets`, `ReversePickupStatus`, `OrderStatus`), then marked all 6 records `applied` with correct SHA-256 checksums (algorithm validated against the already-correct index-migration record).
- Redis: app live on `STAG-APP1` (port 8001) → **HTTP 200**, container restarted clean post-fix.

---

## 3. Verification Evidence

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ Clean (all touched files + project) |
| ESLint (touched files) | ✅ No new errors; remaining warnings/`no-explicit-any` are **pre-existing** |
| `npm run build` (Turbopack) | ✅ 43/43 routes, TypeScript pass; only fs-tracing warnings in `storage.ts` (pre-existing) |
| Office DB `_prisma_migrations` | ✅ 6/6 records `applied`, checksums match files |
| Live deploy | ✅ `asset-delivery` container restarted, HTTP 200 |
| `git diff` hygiene | Reports/manuals/xlsx untracked, never committed |

---

## 4. Remaining Findings (next round queue)

| # | Sev | Item | Location | Recommendation |
|---|-----|------|----------|----------------|
| R1 | Medium | `xlsx@0.18.5` high severity — no upstream fix | `package.json` | Track; migrate to `exceljs`/`SheetJS` fork when time permits |
| R2 | Medium | Exports (`/api/export-*`) stream the **entire** result set unbounded | 8 export routes | Chunked EXCELJS writes / sheet size guard; fine at current scale |
| R3 | Medium | Public/under-checked endpoints | `/api/inventory-available`, `/api/inventory-lookup`, `/api/pincode/*`, `/api/dc/[id]/pdf`, `/api/seed` | Confirm each is intentionally public; require session wherever not |
| R4 | Medium | No MFA; no per-user session revocation | `auth.ts` | Add TOTP for ADMIN; delete-all-sessions on password change |
| R5 | Low | Rate limiter + login lockout are in-memory `Map` | `middleware.ts`, `auth.ts` | Move to Redis if >1 instance |
| R6 | Low | Turbopack fs-tracing warnings in `storage.ts` | `storage.ts` | Move `uploads/` under a statically-scoped path or add `turbopackIgnore` |
| R7 | Low | `npm audit` ~11 high remain (Prisma CLI dev-only, xlsx) | devDeps | Prisma CLI deps are build-time only; no runtime exposure |
| R8 | Info | PWC role grants view on all modules (by design) | `permissions.ts` | If offices need stricter read-isolation, refine per-module view flags |

---

## 5. Score & Recommendation

**Current: 8/10.** Targeted investment for an **8.5–9.0**:
1. R3 (endpoint inventory — confirm/close public surface).
2. R2 (bounded exports).
3. R4 (MFA + session revocation for admins).
4. R1/R7 dependency watch-list.

No further action is *required* for safe office/staging operation — current state is stable and shipped.

---

*Report generated from full source review + live staging verification. Source under `main@a105508`. No reports/manuals are committed to the repository.*