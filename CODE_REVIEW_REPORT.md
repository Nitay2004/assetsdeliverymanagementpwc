# CODE_REVIEW_REPORT.md — Asset Delivery System

**Date:** 2026-10-18
**Scope:** Full codebase review — tests, scripts, critical bugs, code smells
**Codebase stats:** 202 TS/TSX files in `src/`, ~36,563 lines; 20 server-action files; 26 API routes; 59 script files
**Method:** Static analysis only (no code was changed). Verified with `npx tsc --noEmit` (✅ clean) and `npm run lint` (❌ 334 problems).

---

## 0. TL;DR — "Can we run tests locally?"

### ❌ **No — there are no tests to run.**

There is **zero test infrastructure** in this project:

| Check | Result |
|---|---|
| `*.test.ts` / `*.test.tsx` / `*.spec.ts` files | **0 found** |
| `__tests__/` directories | **0 found** |
| `vitest` / `jest` / `cypress` / `playwright` in `package.json` | **Absent** |
| `"test"` script in `package.json` | **Absent** (scripts are only `dev`, `build`, `start`, `lint`, `postinstall`) |
| Test runner binaries in `node_modules/.bin` (`vitest`, `jest`) | **Not installed** |
| Test config (`vitest.config.*`, `jest.config.*`) | **None** |
| CI (`.github/workflows/deploy.yml`) runs tests | **No** — only `tsc --noEmit` + non-blocking `lint` |

Files that *look* like tests but are **not**:
- `scripts/test-assign-insert.js`, `scripts/test-rp-cols.js`, `scripts/test-rp-insert.js`, `scripts/test-headers.ts` — one-off **manual DB probe scripts** (run a query, print rows). No assertions, no framework. And `scripts/*.js` is gitignored anyway.

**What CAN be run locally today (quality gates that exist):**

```bash
npx tsc --noEmit     # ✅ PASSES clean (this is the only real gate)
npm run lint         # ❌ 334 problems (254 errors, 80 warnings) — non-blocking in CI
```

**To make tests runnable**, you'd need to add a runner (Vitest is the natural fit for Next 16 + TS) and write actual tests. Suggested first targets are listed in §5.

---

## 1. CRITICAL ISSUES (fix first)

### C1. 🔴 `globalSearch` fetches data **before** filtering by permission
**File:** `src/app/actions/search.ts:23-136`

The auth check (`getSession`) is present ✅ — but the **module-permission filter runs at the very end** (`results.filter(...)` on line 135). All four `findMany` queries run regardless of what the user is allowed to see. A user with only `warehouse` access still triggers full inventory/order/asset/docket scans and receives the filtered output.

- Impact: permission enforcement happens after data access (defence-in-depth violation), plus wasted DB work.
- Also: a `PWC` user passes `canView` for everything, but a restricted `WARRANTY` user triggers queries whose results are then thrown away.
- Fix: build the `OR`/module list **before** querying; skip queries for modules the user can't view.

### C2. 🔴 DC number generation has a **TOCTOU race with no retry**
**Files:** `src/app/actions/dc.ts:44-59, 128, 345` + `src/lib/sequence-number.ts:38`

`getNextDcNumber()` does read-max-then-increment. Two Finance users clicking "Generate DC" simultaneously get the **same number**, and `DeliveryChallan.dcNumber` is `@unique` (`prisma/schema.prisma:699`) → the second insert throws a raw `P2002` Prisma error to the UI.

- Notably, the team **already knows this pattern**: `reverse-pickup.ts:382-393` wraps its equivalent create in a 3-attempt P2002 retry loop. `dc.ts` does **not**.
- Also affects `vendor-master.ts:10` and `api/import-reverse-pickup/route.ts:394` (the import route does have a retry — verify `dc.ts` paths).
- Fix: apply the same P2002 retry loop used in `reverse-pickup.ts`, or take the sequence + insert inside one transaction with `SELECT ... FOR UPDATE`.

### C3. 🔴 Race condition in `sequence-number` under concurrency (root cause of C2)
**File:** `src/lib/sequence-number.ts:38-48`

`$queryRawUnsafe` runs `SELECT max ... LIMIT 1` with **no locking and no transaction**. Safe identifiers are validated (✅ good — regex allowlist, pattern bound as `$1`, so no SQL injection), but correctness under concurrency is not guaranteed. Two callers read the same max.

- Fix: either `FOR UPDATE`/advisory lock (`pg_advisory_xact_lock`) inside a transaction, or let a DB sequence/serial own the counter and map it to the prefixed format.

### C4. 🔴 Rate limiter + login lockout are **in-memory `Map`s** → bypassable & leaky
**Files:** `src/proxy.ts:10-27`, `src/app/actions/auth.ts:19-43`

- Resets on every deploy/restart (attacker just waits for a restart or restarts… their own session).
- **Does not work multi-instance** (Next can run multiple processes/containers; `docker-compose.yml` present).
- `rateLimitMap` in `proxy.ts` is **never cleaned** — entries only get overwritten when the same key comes back. IP-keyed maps under scan traffic = unbounded memory growth (slow memory leak / DoS vector).
- Keyed on `x-forwarded-for` first value (`proxy.ts:40`) which is **client-spoofable** if not behind a trusted proxy that overwrites it — attacker can rotate fake IPs to reset the limit.
- Impact: login brute-force protection (5 attempts/15 min) is effectively advisory.
- Fix: shared store (Redis/DB) or at minimum a periodic sweep + strip/normalize `X-Forwarded-For` at the edge.

### C5. 🔴 TOTP encryption key silently falls back to **empty string**
**File:** `src/lib/auth.ts:130-135`

```ts
.update(`devit-2fa-pending:${process.env.TWO_FACTOR_ENCRYPTION_KEY ?? ""}`)
```

`two-factor.ts:23-33` **throws** when the key is missing/invalid (correct behaviour). But `auth.ts` `twoFactorPendingKey()` uses `?? ""` — if `TWO_FACTOR_ENCRYPTION_KEY` is unset, the 2FA pending-cookie HMAC is derived from a **publicly known constant**, meaning anyone can forge a `devit_2fa_pending` cookie for **any userId** and jump straight to the TOTP step for that user (they'd still need to guess the TOTP, but they get unlimited offline-free attempts at the second factor for an arbitrary account, bypassing the password step entirely).

- Fix: fail fast like `getEncryptionKey()` does — remove `?? ""` and throw.

### C6. 🔴 TOTP tolerance is ±600 seconds (20-minute window)
**File:** `src/lib/two-factor.ts:12-16`

A captured/shoulder-surfed 6-digit code is valid for ~20 minutes instead of 30 seconds. Documented tradeoff (clock skew on STAGE-APP1), mitigated by attempt cap + replay guard — but the mitigation depends on C4 (in-memory attempt map), which resets on restart. Net: weak.

- Fix: run NTP on app servers, tighten to ±1 step (30–90s), keep replay guard.

### C7. 🟠 Import path casts away Prisma typing (`as any` on models)
**Files:** `src/app/api/import-csv/route.ts:809, 1126, 1207, 1219, 1284, 1321, 1335, 1364` and `src/app/actions/import-csv.ts:330, 340, 346, 356, 365`

`prisma.inventoryItem.findMany as any`, `data: cleanData as any`, `createMany({ data: batch as any[] })` — the import pipeline bypasses the generated Prisma types entirely. A column rename or schema change will **not** be caught by `tsc` here; failures surface at runtime as Prisma validation errors during a file import (partial writes, confusing user errors).

- Worst offender: `route.ts:809` `(prisma.inventoryItem.findMany as any)(...)` — casting the *method itself*.
- Fix: type the import row shape explicitly (map CSV headers → typed payload) and drop the casts.

### C8. 🟠 `role as any` in admin actions — invalid enum values accepted
**File:** `src/app/actions/admin.ts:58, 83, 92, 116, 164`

`formData.get("role") as string` is never validated against the `UserRole` enum before `role: role as any`. A crafted POST with `role=SUPERADMIN` either fails at the DB layer with an opaque error or — worse — stores a role string that `getDefaultPermissions()` doesn't recognise, producing a user with **zero permissions** (or an unhandled value in `canModuleAction` fallbacks).

- Fix: validate against `Object.values(UserRole)` before write; type `permissions` as `Prisma.InputJsonValue` instead of `as any`.

### C9. 🟠 SSRF-ish / unauthenticated-surface audit of `/api/*` — mostly ✅, two gaps
**File:** `src/proxy.ts:43-58`

The proxy **explicitly skips all auth for `/api/*`** (`return NextResponse.next()` after rate limiting only). Every API route must self-authorize. I audited all 26 routes:

- ✅ 24/26 call `getSession()` and 401 properly (verified: exports, imports, upload, pods, pincode, products, dc/pdf, pod-file, pod-url, inventory-*, pafex sync).
- ⚠️ `/api/seed` → returns 404 always (safe, but dead code — delete it).
- ⚠️ `/api/auth/clear-session` → intentionally unauthenticated (deletes cookie's session — fine, no privilege gain).
- **Gap:** module **permission** (not just login) is inconsistently enforced on exports: `export-inventory`/`export-cases` require `ADMIN`, but `export-warehouse`, `export-finance`, `export-logistics`, `export-provisioning`, `export-reverse-pickup` only require *any* session — a logged-in `PWC` (view-all) or `WARRANTY` user can export the **whole** warehouse/finance/logistics datasets as spreadsheet files, bypassing the UI's module gates. Cross-module data export is a real authorization bypass at the API layer.

### C10. 🟠 Unbounded queries/exports (performance = availability)
**Files:** `src/app/dashboard/page.tsx` (per `APP-REVIEW-REPORT` P1), all 8 `export-*` routes

Dashboard loads **all** orders + **all** inventory rows with no `take`; exports stream the entire table. Fine at current scale, single big-table growth turns this into a page-timeout / pool-exhaustion issue (pool is `max: 5` — `src/lib/prisma.ts:25`, and dashboards already fire 7 concurrent aggregates > 5 connections, so queries *queue* by design).

---

## 2. SECURITY SUMMARY

| # | Severity | Finding | Location | Status |
|---|---|---|---|---|
| S1 | Fixed ✅ | `globalSearch` had no auth | `actions/search.ts` | Auth added; but see **C1** (filter ordering) |
| S2 | Fixed ✅ | Proxy only checked cookie presence | `src/proxy.ts:70-99` | Now DB-validates session, drops bad cookies |
| S3 | Partial ⚠️ | Cookie `secure` flag **opt-in via env** (`SESSION_COOKIE_SECURE`), default OFF | `auth.ts:20` | Default is insecure; flip default to secure |
| S4 | Fixed ✅ | Client-only `ModuleGuard` | `proxy.ts:107-112` | Server-side module gate now exists |
| S5 | Fixed ✅ | `/api/pincode` unauthenticated | `api/pincode/[pincode]/route.ts:8` | Now requires session |
| S6 | Fixed ✅ | POD files committed to git | `.gitignore:51` (`/public/uploads`) | Ignored now; **history still contains old files** — rotate/purge if sensitive |
| S7 | ⚠️ | In-memory rate limits (see **C4**) | `proxy.ts`, `actions/auth.ts` | Open |
| S8 | ⚠️ | `.env` holds service-role key + 2FA key; **no `.env.example`** | `.env` (gitignored ✅) | Onboarding risk — add `.env.example` with empty placeholders |
| S9 | ⚠️ | TOTP ±10 min window (see **C6**) | `two-factor.ts:16` | Open |
| S10 | ⚠️ | `console.error` logs 2FA decrypt failures (no secret logged ✅) but no structured logging/monitoring | `auth.ts:148` | Minor |
| S11 | ✅ | SQL injection | Only raw SQL is `sequence-number.ts` — identifiers regex-validated, regex bound as parameter | Safe |
| S12 | ✅ | Session tokens hashed (SHA-256) before DB storage; timing-safe 2FA cookie compare; bcrypt(10); magic-byte upload validation; path-traversal guards in `storage.ts` | — | Good |

**Positive security notes** (don't regress these): `requireAuth()` self-authorization on server actions is consistently applied (audited: every action file calls `getSession`/`requireAuth`); admin role/password changes revoke all sessions (`admin.ts:100-105`); 2FA recovery codes single-use + hashed; TOTP replay guard stores accepted time step.

---

## 3. TYPE SAFETY & ERROR HANDLING

| Metric | Value |
|---|---|
| `npx tsc --noEmit` | ✅ **0 errors** |
| `npm run lint` | ❌ **334 problems (254 errors, 80 warnings)** |
| `: any` / `as any` occurrences in `src/` | **108** |
| `catch (err: any)` / `catch (e: any)` | **53** |
| `no-explicit-any` lint errors | Majority of the 254 errors |

**Key type-safety issues:**

1. **`catch (err: any)` × 53** — components read `err.message`/`err.response` off untyped values. One wrong assumption = silent `undefined` in a toast. Standardize a `getErrorMessage(err: unknown): string` helper (some files already do the right `err && typeof err === "object" && "code" in err` dance — e.g. `dc.ts:77-81`).
2. **`as any` into Prisma writes** (`admin.ts`, `import-csv`, `logistics.ts:185`, `warehouse.ts:60`) — bypasses enum checking. `logistics.ts:185` / `warehouse.ts:60` pass a form-string straight into `status: status as any`; an unknown status string hits the DB enum and throws a raw Prisma error at the user.
3. **`e as any)?.code === "P2002"`** (`inventory.ts:139`) vs the correct typed check `error instanceof Prisma.PrismaClientKnownRequestError` already used in `reverse-pickup.ts:390` — two patterns coexist; standardize on the typed one.
4. **Error messages leak Prisma internals in a few spots** (mostly caught and replaced ✅, e.g. `inventory.ts:142` → `"Failed to add item."`), but server-action throws are surfaced verbatim in dev/preview; ensure `NODE_ENV=production` in the deployed container so Next masks them.

**CI gate weakness:** `deploy.yml:34` runs `npm run lint || echo "non-blocking"` — 254 errors never block a deploy. The typecheck gate is good; lint should at least be made blocking for *new* violations (ratchet).

---

## 4. SCRIPTS FOLDER REVIEW (59 files)

**Verdict: mostly one-off ops/forensics scripts — a handful are genuinely reusable; most are dead weight.**

### ✅ Reusable / keep (with light cleanup)

| Script | Purpose | Note |
|---|---|---|
| `setup-db.sh` | Boot local Postgres in Docker | Onboarding essential |
| `migrate-db.sh` | Dump/restore Supabase → self-hosted | One-time migration, keep archived |
| `check-db.ts` | DB connectivity + version probe | Reusable diagnostic |
| `check-counts.js`, `check-schemas.js`, `enum-check.js` | Schema/data sanity probes | Merge into one `db-doctor` script |
| `generate-diagrams.mjs`, `render-full-diagram.mjs`, `render-runtime-diagram.mjs`, `svg-to-png.mjs`, `generate-architecture-xlsx.js` | Docs/diagram generation | Reusable docs toolchain |
| `update-sla.cjs` | Backfill SLA fields (uses `$transaction`, env-guarded ✅) | Past backfill — archive |
| `fix-*.ts/js`, `mark-*.js`, `insert-missing-rp.js` | **One-time data repairs** | ⚠️ **Dangerous to keep around** — they mutate prod data and can be run accidentally. Archive or delete. |
| `test-*.js/ts` | Manual DB probes | Not tests (see §0) |
| `*-report.js`, `*-check.js`, `report-18aug.js` | Point-in-time forensic reports (Aug 18 incident) | Delete or move to `archive/` |

### Problems with the scripts folder
1. **`.gitignore:54` ignores `/scripts/*.js`** — 40+ `.js` scripts exist locally but are *never committed*; they exist only on this machine. The `.ts`/`.mjs`/`.sh` ones are committed. Confusing split; someone else cloning the repo gets a partial scripts folder.
2. **`tsconfig.json:33` excludes `scripts`** — no typechecking on `.ts` scripts (`check-db.ts`, `fix-*.ts`), so type errors there are invisible to the CI gate.
3. **Some scripts were historically hardcoded with DB credentials** (`.gitignore:53` comment admits this) — the current `.ts` ones correctly read `process.env.DATABASE_URL` ✅. Verify no committed `.js` variant still contains a literal connection string before this repo leaves the office (grep found none today ✅).
4. **`supabase-old.env`** — old credentials file, gitignored ✅, but should be destroyed once migration is confirmed complete.
5. No `package.json` entries call any script — nothing is wired for reuse.

**Suggested:** `scripts/` → split into `scripts/db/` (probes), `scripts/ops/` (one-time fixes, read-only by default), `scripts/docs/` (diagram gen), `scripts/archive/`. Add a `--dry-run` convention for anything that writes.

---

## 5. CODE SMELLS & SUGGESTED REFACTORS

### Priority 1 — correctness

1. **`dc.ts` DC-number race** → extract a shared `withSequenceRetry()` helper (the loop already written in `reverse-pickup.ts:382-393`) and use it in `generateDC`, `generateReversePickupDc`, `vendor-master.ts`. (C2)
2. **Permission filter before query in `globalSearch`** → build per-module queries only for viewable modules; also lets you drop the `Promise.all` cross-module scan for restricted users. (C1)
3. **Export routes: enforce module permission, not just login** → reuse `requirePermission(user, "warehouse", "canView")` etc. in each `export-*` route. (C9)
4. **Multi-step writes without transactions** — `generateReversePickupDc` does `create(DC)` → `update(RP)` → `update(inventory)` as 3 separate writes (`dc.ts:366-420`); a failure mid-way leaves DC created but RP status stale. Same in `admin.ts:95-105` (update user, then delete sessions — failure = old sessions survive a role change). Wrap in `prisma.$transaction`.
5. **Race in client search UI** — `global-search.tsx:52-69`: debounce timer cleared, but an *in-flight* `globalSearch(query)` from a previous keystroke can resolve **after** the newer one and overwrite `results` with stale data (classic out-of-order response). No `AbortController`/sequence guard anywhere in `src/` (grep confirmed: **0 uses**). Add a request-sequence counter or ignore flag.
6. **`assign-user-modal`, `inventory-detail-drawer`, etc. — 30+ `useEffect`s with async fetch and no cancellation** — same stale-response class of bug; standardize a `useAbortableEffect` hook.

### Priority 2 — maintainability

7. **God files**: `api/import-csv/route.ts` (1,260 lines), `actions/reverse-pickup.ts` (1,008), `components/reverse-pickup-detail.tsx` (947), `actions/inventory.ts` (826). Split import-csv into `parse/validate/persist` modules; `addInventoryItem` alone is a 100-line `create()` call (`inventory.ts:65-137`) that should be a `formDataToInventoryItem()` mapper.
8. **Duplicated field mapping** — `api/import-csv/route.ts` and `actions/import-csv.ts` both map CSV rows → Prisma data with `as any` casts (C7). One typed mapper, two callers.
9. **`resolveSla()` called twice with identical args** (`inventory.ts:102-104`) — compute once into a const.
10. **Two error-checking idioms for Prisma codes** — `instanceof Prisma.PrismaClientKnownRequestError` vs `(e as any)?.code` — unify (see §3).
11. **`catch (err: any)` × 53** → introduce `toErrorMessage(err: unknown)` in `src/lib/utils.ts`.
12. **Inconsistent auth helpers** — `requireAuth()`, `getSession()` + null-check, `requirePermission()`, `requireAdmin()`, `requireModuleEditOrReversePickup()`, `requireReverseQcWork()` — the last two are file-private duplicates of the same idea. Promote to `src/lib/permissions.ts` as `requireAnyPermission([{module, action}, ...])`.
13. **Permission checks are inconsistent across similar actions** — e.g. some warehouse/logistics actions call only `getSession()` (lines found: `warehouse.ts:14,55`, `logistics.ts` 9 occurrences) and check nothing beyond login? *(Spot-check shows `requirePermission` is used in most, but the mixed `getSession`/`requireAuth` style makes it hard to audit — a lint rule or wrapper would make "every exported action starts with requireX" mechanically checkable.)*
14. **`proxy.ts` session lookup duplicates `auth.ts` logic** (hash + expiry + absolute timeout written twice, `proxy.ts:70-91` vs `auth.ts:64-120`) — drift risk; export one `validateSessionToken()` from `auth.ts` and use it in both. Note proxy does *not* slide the idle window (by design — cookies can't be set in middleware), but the duplication of constants (`ABSOLUTE_TIMEOUT_MS`, cookie name) is fragile.
15. **Dead code**: `api/seed/route.ts` (always 404) — delete.

### Priority 3 — hygiene

16. **Lint debt**: 254 errors, mostly `no-explicit-any`. CI deliberately tolerates it (`deploy.yml:34`). Set up a ratchet (count-based budget that only goes down).
17. **Unused vars warnings** (`clearColumn`, `key`, `Prisma` imports) — trivial cleanup.
18. **`react-hooks/set-state-in-effect` errors** (e.g. `advance-provisioning-modal.tsx:172`) — 2026 React lint rule; reset state during render instead.
19. **`npm audit`: 8 high** — `xlsx@0.18.5` (Prototype Pollution GHSA-4r6h-8v6p-xvw6 + ReDoS; **no fix available** on npm — the package is abandoned there; SheetJS distributes fixed versions only via their own CDN. Migrate to `exceljs` or a vendored fixed SheetJS). `braces`/`micromatch` chain comes via `shadcn` — note `shadcn` is in **`dependencies`** (`package.json:28`) but it's a *CLI dev tool*; move it to `devDependencies` (also drops the braces advisory from prod installs).
20. **No `.env.example`** — add one documenting `DATABASE_URL`, `DIRECT_URL`, `SESSION_COOKIE_SECURE`, `TWO_FACTOR_ENCRYPTION_KEY`, `PAFEX_*`, `SEED_ADMIN_PASSWORD`, `UPLOAD_DIR`, `APP_PORT`.
21. **`dev-server.log`, `tsconfig.tsbuildinfo`, `project.tgz`, `*.xlsx` reports at repo root** — some gitignored, some not (`ARCHITECTURE_pwc.xlsx`, `Server_Consolidation_Plan.xlsx` show as untracked). Tidy root; docs → `docs/`.
22. **`prisma` migrations**: 23 migrations present and ordered ✅ — but the base schema appears to have been created outside a migration (`migrate-db.sh` dumps schema manually), so `prisma migrate dev` on a fresh DB may not bootstrap cleanly. Verify with a clean-slate `migrate deploy` rehearsal.

---

## 6. WHAT'S ACTUALLY GOOD (preserve)

- ✅ `tsc --noEmit` is **clean** across 36.5k lines — genuine type-safety baseline.
- ✅ Session handling is well above average: hashed tokens, idle + absolute timeouts, sliding window with write-batching, disabled-account session revocation, DB validation in middleware, `timingSafeEqual` on the 2FA cookie.
- ✅ Raw SQL: single call site, identifier allowlist + bound parameters — no injection risk.
- ✅ File uploads: magic-byte validation, size caps, path-traversal guards, Supabase-vs-local abstraction with signed URLs.
- ✅ Consistent `requireAuth()` self-authorization pattern on server actions (the classic Next.js hole is closed).
- ✅ Comments are exceptionally good — race conditions, ordering constraints and tradeoffs are explained at the call site (e.g. `sequence-number.ts`, `two-factor.ts`, `auth.ts`).
- ✅ CI runs typecheck *before* deploy with a keep-serving fallback (good rollback posture).
- ✅ `seed.mjs` refuses to run without an explicit `SEED_ADMIN_PASSWORD` (no default creds in repo).

---

## 7. PRIORITIZED ACTION PLAN

| # | Action | Effort | Why |
|---|---|---|---|
| 1 | Add Vitest + first tests (see below) | 0.5 day | Nothing is verified today |
| 2 | Fix `TWO_FACTOR_ENCRYPTION_KEY ?? ""` fallback (**C5**) | 5 min | Forgeable 2FA pending cookie |
| 3 | Add P2002 retry to DC generation (**C2/C3**) | 1–2 h | User-facing 500s + duplicate-number risk |
| 4 | Enforce module permission on `export-*` routes (**C9**) | 2 h | Cross-module data export bypass |
| 5 | Move `globalSearch` permission filter before queries (**C1**) | 1 h | Authz hygiene + perf |
| 6 | Make rate-limit store shared/swept + fix `x-forwarded-for` trust (**C4**) | 0.5–1 day | Brute-force protection is cosmetic today |
| 7 | Validate `role` enum in admin actions (**C8**) | 1 h | Bad roles → broken/zero-permission users |
| 8 | Wrap multi-step writes in `$transaction` (`dc.ts`, `admin.ts`) | 0.5 day | Partial-failure data drift |
| 9 | Tighten TOTP window after NTP fix (**C6**) | 0.5 day | 20-min code validity |
| 10 | Delete/repair `as any` in import pipelines (**C7**) | 1 day | Silent runtime breakage on schema change |
| 11 | Stale-response guard in fetch effects (search UI) | 0.5 day | Wrong results shown |
| 12 | Lint ratchet + move `shadcn` to devDeps + track `xlsx` migration | 0.5 day | CI signal + supply chain |

**Suggested first tests (highest ROI, no framework exists yet):**
1. `sequence-number` — mock Prisma, assert identifier rejection + retry behaviour (C2/C3).
2. `permissions.ts` — `canViewModule` truth table per role (this is the whole authz model and has **zero** coverage).
3. `two-factor.ts` — `verifyTotp` window + replay guard (pure functions, trivial to test, security-critical).
4. `auth.ts` — `getPendingTwoFactor` tampered/expired cookie cases.
5. `storage.ts` — `assertSafePodPath` path-traversal cases.
6. One server action per module asserting `Unauthorized`/`Permission denied` for a session-less caller (locks the C1/C9 class of bug).

---

*Report generated by static review. No source files were modified. Findings from prior reports (`APP-REVIEW-REPORT.md`, `APP-AUDIT-REPORT.md`) were cross-checked: S1–S6 fixes verified as landed; C2, C5, C9, and the export-permission gap are **new/remaining** findings not covered by those reports.*
