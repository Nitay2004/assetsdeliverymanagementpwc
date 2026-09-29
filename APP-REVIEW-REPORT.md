# Asset Delivery System — App Review Report

**Date:** 21 Sep 2026
**Scope:** Full codebase review (routes, API, server actions, schema, auth, performance, security)
**Stack:** Next.js 16.2.7 · React 19 · Prisma 7 + PostgreSQL · Supabase Storage · pdfmake · xlsx

---

## 1. Executive Summary

| Area | Rating | Notes |
|------|--------|-------|
| Architecture | Good | Clean App Router structure, modular, role-based permissions |
| Features | Good | Full forward + reverse logistics workflow, 24 API routes, 20 server actions |
| Performance | Medium | Fast at current scale; will degrade on dashboard + filters without pagination |
| Security | Medium | Solid base; several auth-gap and hardening items outstanding |
| Code hygiene | Good | `.env` gitignored, session tokens hashed, rate limiting present |

**Overall:** Production-ready foundation, feature-rich, well-organized. Fix the high-priority security + performance items below to make it robust at scale and safe to expose beyond the office network.

---

## 2. Architecture Overview

- **Modules:** Inventory, Assigned Assets, Warehouse, Provisioning, Finance, Logistics, Reverse-Pickup, Warranty, Product Master, Vendor Master, Admin (Users).
- **Roles:** ADMIN, WAREHOUSE, PROVISIONING, FINANCE, LOGISTICS, WARRANTY, REVERSE_PICKUP, PWC.
- **Permission model:** `src/lib/permissions.ts` — `canView/canCreate/canEdit/canDelete` per module per role. Admin has everything; PWC is view-only.
- **Auth:** `devit_session` cookie (httpOnly, sameSite:lax, **secure:false**), sha-256-hashed session tokens in DB, 15-min idle + 8-hr absolute expiry, bcrypt password hashing, 5-attempt / 15-min login lockout.
- **Data model (13 models):** User, Session, Order (23 statuses incl. RTO path), Asset, InventoryItem (~100 columns incl. SLA/QC/provisioning/tracking), AssignmentRecord, DeliveryRecord, RtoRecord, DropdownOption, ReversePickupRequest (27 statuses), VendorMaster, ProductMaster, Warehouse, Docket, DeliveryChallan + Items.
- **PDF/Excel:** pdfmake for Delivery Challans & DCs, xlsx/csv-parse for import/export.
- **Deployment:** Docker, multi-stage build, `standalone` output, Nginx-style reverse proxy expected on host, Postgres on separate DB server (`10.199.206.99:5433`), local `uploads/` volume.

---

## 3. Performance Assessment

### What is good
- Inventory table uses **server-side pagination** (25/page default, capped at 100) with SQL-level search & filters (`inventory/page.tsx`).
- Homepage DB queries run in parallel (`Promise.all`).
- Server actions are targeted (per-status transitions, transactions where needed — e.g. `updateOrder`).

### What will slow down
| # | Issue | Location | Impact |
|---|-------|----------|--------|
| P1 | Dashboard loads **all** orders (with assets) and **all** inventory rows into memory — no `take` limit | `src/app/dashboard/page.tsx:82-88` | Slow dashboard as data grows |
| P2 | `contains` (LIKE `%...%`) queries on trackingStatus/trackingSubStatus — no index, full table scan | `dashboard/page.tsx:106-129` | Expensive on large tables |
| P3 | Column-filter dropdowns `findMany` **entire table** every page load to compute distinct values | `inventory/page.tsx:69-72` | Every inventory page hit loads whole table |
| P4 | `getSession()` writes a DB update (idle-expiry slide) on **every** request/action | `src/lib/auth.ts:87` | Extra DB write per page load |
| P5 | Rate limiter + login lockout are in-memory `Map` | `middleware.ts`, `actions/auth.ts` | Resets on restart / multi-instance; bypassable at scale |

### Recommendation (perf)
- Paginate dashboard queries (`take: N`) and use `count` for the stat cards.
- Add Postgres indexes on frequently-filtered/`contains` columns; prefer discrete status enums over string `contains`.
- Compute distinct filter values via a `GROUP BY`/`DISTINCT` query instead of full-table fetch.
- Move session expiry rolling to a lazy/periodic strategy (only touch DB on expiry, or use a short TTL cookie).
- Move rate limiting to a shared store (Redis/DB) if going multi-instance.

---

## 4. Security Assessment

### What is good
- Session tokens hashed (sha-256) before storage; `httpOnly` cookie.
- Login brute-force protection (per-email, in-memory).
- API rate limiting in middleware (120/min general; 10/min uploads).
- bcrypt (10 rounds), security headers (HSTS, X-Frame-Options DENY, X-Content-Type nosniff, Referrer-Policy, Permissions-Policy).
- Admin-only export endpoints checked server-side.
- `.env` / `.env.local` gitignored; `postinstall: prisma generate` in CI/Docker.

### Security gaps
| # | Severity | Issue | Location |
|---|----------|-------|----------|
| S1 | **High** | `globalSearch` server action has **no auth check** — anyone (even anonymous) can enumerate inventory/orders/dockets, exposing serials, emails, mobiles, addresses. Server actions bypass middleware | `src/app/actions/search.ts:21` |
| S2 | **High** | Middleware only checks cookie **presence**, not DB validity — invalid/expired session still reaches pages | `src/middleware.ts:49-53` |
| S3 | **High** | Session cookie `secure: false` — sent over plain HTTP; MITM cookie theft risk | `src/lib/auth.ts:30` |
| S4 | Medium | `ModuleGuard` is **client-only** (redirect); pages don't re-verify permission server-side. Direct-URL access to modules beyond role risk | `src/components/dashboard/module-guard.tsx`, dashboard pages |
| S5 | Medium | `/api/pincode` is fully unauthenticated (probes/abuse, though rate limited) | `src/app/api/pincode/[pincode]/route.ts` |
| S6 | Medium | POD files under `public/uploads/pod/*` are **committed to git** (serial/pickup-related documents) | git history |
| S7 | Low | Login lockout message reveals remaining wait time | `src/app/actions/auth.ts:25` |
| S8 | Low | Service-role key present in `.env`/`.env.local` (gitignored — fine, but must not leak) | `.env` |

### Recommendation (security)
1. Add session/permission check to `globalSearch` (and all server actions that can leak data).
2. Make middleware validate the session against the DB (or do a light check).
3. Set `secure: true` for the session cookie once HTTPS is enforced; add HSTS already present.
4. Add server-side permission guards in each page (`requirePermission`).
5. Require auth on `/api/pincode` (any logged-in user).
6. Remove `public/uploads/pod/*` from git + add to `.gitignore`; purge from history if needed.
7. Rotate the Supabase service-role key periodically.

---

## 5. Functional Observations (Domain Logic)

- DC-first flow, docket courier printed on DC PDF, orders remain visible across all module datatables — intentional and works.
- Cutoff/SLA start date auto-computed from email-received hour.
- Server-side Excel-style column filters with multi-select and Apply on dashboard tables.
- Clickable inventory status cards open modal tables on dashboard.
- RTO flow: `markAsRto` only allowed from DISPATCHED; items return to AVAILABLE on `RTO_DELIVERED_TO_WAREHOUSE`.
- `hasPriorDelivery` prevents duplicate assignment of already-delivered items.
- Reverse pickup request number auto-increments (`RPU-XXXX`).

---

## 6. Suggested Fix Queue

**High priority**
1. Auth check on `globalSearch`
2. DB-validating middleware + server-side page guards
3. `secure: true` cookie (after HTTPS)
4. Paginate dashboard queries + indexed filtering

**Medium priority**
5. Distinct-values via GROUP BY (stop full-table fetch on inventory page)
6. Auth on `/api/pincode`
7. Untrack POD uploads from git
8. Lazy session-expiry updates

**Low priority**
9. Redis-backed rate limiting if more than one instance
10. Neutral login-lockout messages
11. Key rotation for Supabase service role

---

## 7. Fix Status (applied)

| Item | Status | Change |
|------|--------|--------|
| S1 | ✅ Done | `globalSearch` now requires a valid session |
| S2 | ✅ Done | `middleware.ts` → `proxy.ts` (Next 16), DB-validates every session, drops invalid cookies |
| S3 | ✅ Done | Cookie `secure` flag now driven by `SESSION_COOKIE_SECURE=true` env (HTTPS) |
| S4 | ✅ Done | Server-side module permission gate in proxy (all dashboard pages) |
| S5 | ✅ Done | `/api/pincode` requires a logged-in session |
| S7 | ✅ Done | Neutral "Too many login attempts. Please try again later." |
| P1 | ✅ Done | Dashboard now uses DB `groupBy`/`count` — no unbounded order/inventory loads |
| P2 | ✅ Done (code) | Index migration added — **must be applied to the DB** (see below) |
| P3 | ✅ Done | Inventory column-filter values via `groupBy`, full-table fetch removed |
| P4 | ✅ Done | Session expiry sliding only writes to DB when close to expiry |
| S6 | ✅ Done | `public/uploads` untracked + gitignored (files still on disk) |

**Manual follow-ups (required):**
1. **Apply the DB migration** on the office/staging database:
   ```
   npx prisma migrate deploy
   ```
   (adds `pg_trgm` GIN + btree indexes; `pg_trgm` is a trusted extension so DB owner can enable it).
2. **Set `SESSION_COOKIE_SECURE=true`** in `.env`/docker-compose once an HTTPS proxy/domain is in front of the app.
3. Rotate the Supabase service-role key periodically.
4. If the app ever runs on more than one instance, move rate limiting to a shared store (Redis).

---

*Report generated from full source review — no code was modified.*