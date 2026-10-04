# Asset Delivery System — User Manual

**System:** DEV IT Asset Delivery System (PWC asset delivery tracker)
**App name shown in UI:** Devit
**Stack:** Next.js (App Router), PostgreSQL (Prisma), React

---

## 1. How to Access the System

1. Open your browser (Chrome / Edge recommended).
2. Go to the application URL (business deployment — typically
   `http://<server-host>:8001` or the public domain given to you).
3. The **Login** screen opens.

### 1.1 Login

- Enter your **Email** and **Password** (credentials are provided by the Admin team).
- Click **Login**.
- On success you are taken to the **Dashboard (Overview)**.
- Password can be shown/hidden with the eye icon.

### 1.2 Session & Security

- Session automatically logs out after **15 minutes of inactivity**.
- Maximum session lifetime is **8 hours** regardless of activity.
- If these expire you will be asked to log in again.
- Passwords are stored as encrypted hashes (bcrypt) — nobody including
  admins can see your password.

---

## 2. Dashboard / Overview

The first screen after login gives a real-time summary of the whole pipeline:

**Inventory section**
- Total stock, New stock (brand new laptops), Re-deployment inventory
  (available), Assets allocated to users.
- Total stock card can show stock split by invoicing warehouse.

**Forward Shipment section**
- In Warehouse Allocation (awaiting warehouse)
- In Provisioning (awaiting OS install)
- Packed & Labelled (ready for dispatch)
- In Transit (dispatched)
- Delivered (successfully delivered)
- RTO (return to origin)

**Reverse Shipment section**
- Total Request, Pick-ups Done, Pick-ups Cancelled, In-Transit,
  Received in Warehouse, Align for QC & Blancco.

**SLA**: "SLA Met" cards show records completed within TAT (visible to
internal roles, hidden from PWC view).

**Other widgets**
- **Date Range Picker** — filter all dashboard stats by date range.
- **Order Pipeline** — visual distribution of orders across delivery stages.
- **Recent Activity** — latest order & inventory updates.
- **Quick Access** — shortcut cards for each module.
- Click any stat card to open a detailed modal listing the underlying records.

---

## 3. Roles & Permissions

Each user has one **role**. Access to modules and actions (view / create / edit / delete)
depends on the role and on per-user module permissions set by the Admin.

| Role               | Modules available (by default) |
|--------------------|--------------------------------|
| ADMIN              | All modules, full create/edit/delete rights + Admin (user management) |
| WAREHOUSE          | Warehouse (create/edit), Inventory (view/edit) |
| PROVISIONING       | Provisioning (view/edit) |
| FINANCE            | Finance (view/edit) |
| LOGISTICS          | Logistics (view/edit), Assigned Assets (view) |
| WARRANTY           | Warranty (view/edit) |
| REVERSE_PICKUP     | Reverse Pickup (view/create/edit) |
| PWC                | Read-only view across all modules |

Notes:
- The **Admin** section is only visible to ADMIN users.
- Users who cannot view a module do not see it in the left sidebar at all.
- An ADMIN can override module-level permissions for any individual user
  (Admin → User Management).

---

## 4. Modules (step by step)

### 4.1 Inventory

Central registry of all assets (laptops etc.) by serial number.

**Add a new item**
- Inventory → **Add Asset** (or the + button).
- Fill serial number, model, part no, specs, status, and any assignment
  / warranty / tracking fields shown in the form.
- Save. Item appears in the Inventory table.

**Import from file (CSV / Excel)**
- Inventory → **Import**.
- Upload the CSV/Excel file with the expected columns (serial number, model,
  and other mapped fields).
- The system processes the file and updates/creates inventory records.
- A confirmation shows how many records were processed.

**View details**
- Click any row → **detail drawer** opens with the full record (assignment
  details, QC info, tracking status, dates, and remarks).

**Assign to a user**
- Select an available item → **Assign User** → enter employee details
  (name, email, mobile, shipping address, pincode, purpose, etc.).

**Send to QC**
- Select an item → **Send to QC** → assign a QC engineer.
- QC results (Clean & Purge) get recorded on the item.

**Filters & search**
- Use the filters (status, model, serial, warehouse, etc.) and the global
  search box to find items quickly.

**Export**
- Click **Export** to download the current inventory as a file (CSV/Excel)
  for reporting.

### 4.2 Assigned Assets

- Lists assets currently **allocated to users**.
- Read-only for LOGISTICS; view/edit where permissions allow.
- Export button to download the assignment list.

### 4.3 Warehouse

Manages **orders** and the allocation/provisioning flow.

**Typical order flow (forward shipment)**
1. An order is created (Order Placed).
2. **Allocate** assets for the order.
3. Optionally request **Advance Provisioning** before allocation.
4. Mark QC / assign QC engineer if applicable.
5. Order moves toward Provisioning → Logistics.

**Screens / tabs**
- **Allocations** — allocate suitable inventory items to an order.
- **QC Pending** — items waiting for QC.
- **Pending Allocations** — orders still awaiting asset allocation.
- **Warehouse detail** (`/dashboard/warehouse/[id]`) — order-level operations:
  docket request, DC request, E-way bill, dispatch, delivery confirmation.
- Export button for the warehouse sheet.

### 4.4 Provisioning

Handles OS installation / preparation of assets before dispatch.

- **Import** — bulk import provisioning/asset data from a file
  (engineer name, condition, storage status, rack no, lot numbers, etc.).
- **Tabs** — All / In Progress / Completed etc.
- Each row can be **edited** (edit modal) with results/remarks.
- **QC Work** table shows items needing QC during provisioning.
- **Bulk Advance** — mark multiple items as advanced in one go.
- Export available.

### 4.5 Finance

Handles invoicing and Delivery Challan (DC).

- **DC Generate** — from a qualifying order / reverse pickup, generate a
  **Delivery Challan** (DC number, dates, ship-to / bill-to, items, HSN/SAC,
  quantity, rate, tax values).
- The DC is saved and can be downloaded as a **PDF** (via the DC API).
- **Reverse Pickup DC** section — generate DCs for reverse (return) shipments.
- **Finance Order Table / Row** — per-order finance status.
- Export for finance report (CSV/Excel).

Documents generated: **DC PDF**, **E-Way Bill**, **Invoice** references.

### 4.6 Logistics

Manages dispatch, dockets (courier AWB), e-way bills, and Proof of Delivery (POD).

- **Logistics table & order cards** — view orders in logistics pipeline.
- **Docket** — request/assign docket (courier + AWB number) for orders.
- **E-Way Bill** — request and store e-way bill number/document.
- **Reverse Pickup Docket** — docket section for reverse shipments.
- **Reverse Pickup DC** — hand off to Finance for reverse DC generation.
- **POD** — upload POD documents (PDF/image) against an order and
  **export PODs**.
- **Assigned Assets** (read-only) available to logistics users.
- Export button for logistics data.

### 4.7 Reverse Pickup

Return flow when an asset comes back from a user.

**Create a request**
- Reverse Pickup → **Add**.
- Fill: employee details (name, email, mobile), last working day,
  **serial number** (model auto-links from inventory), accessories, reason,
  **pickup address** (address, landmark, city, state, pincode).
- Save → request number is generated automatically.

**Import**
- Reverse Pickup → **Import** to bulk-register multiple return requests from a file.

**Lifecycle (statuses the team uses)**
1. `REQUESTED` → `PARTNER_ASSIGNED`
2. `DC_REQUESTED` → `DC_GENERATED` (Finance)
3. `EWAY_BILL_REQUESTED` → `EWAY_BILL_GENERATED`
4. `DOCKET_REQUESTED` → `DOCKET_ASSIGNED` (Logistics — docket comes after DC + E-Way bill)
5. `INSPECTED` → `PICKED_UP`
6. `IN_TRANSIT` → `RECEIVED_AT_WAREHOUSE` (received by / received date)
7. QC — two stages: `QC_CLEANED` (Hardware QC) → `QC_COMPLETED` (Software QC)
8. Blancco — two stages: `BLANCO_CLEARED` (Clear) → `BLANCO_PURGED` (Purge + certificate PDF)
9. `COMPLETED`

**Overall QC result rule**
- `qcResult` is auto-derived: **FAIL** if Hardware QC **or** Software QC is marked `FAIL`.
- `PASS` only when **both** Hardware QC and Software QC are `PASS`.
- Both stages stay recordable even after a failure, but Blancco Clear/Purge is blocked
  until the overall QC result is `PASS`.

**Special statuses**
- `PICKUP_CANCELLED`, `DUPLICATE`, `ALREADY_SUBMITTED_TO_PWC_OFFICE`,
  `PENDING`, `PWC_CONFIRMATION_AWAITED`, `GATEPASS_PENDING`,
  `ALIGN_FOR_PICKUP`, `ON_HOLD`, `RTO_CASE`, `LOST_DEVICE`.

**Detail view** (`/dashboard/reverse-pickup/[id]`)
- Request info, user details, asset details, pickup location, SLA/TAT,
  courier & tracking (courier name, docket no, pickup date), inspection,
  warehouse receipt, QC results, Blancco, case info, final disposition.
- Export button available.

### 4.8 Warranty

- Lists allocated assets that may need **warranty records**.
- For each item update warranty period / warranty end period.
- **Warranty Item Table / Row** → per-row editing.
- View access for internal roles.

### 4.9 Product Master

- Catalog of supported products (make, model, part no, description,
  HSN code, GST rate, warranty) used across the system.
- Add / edit products where permissions allow.

### 4.10 Vendor Master

- Registry of vendors (GRN number, name, email, phone, address, contact
  person, GST number, active/inactive).
- Add / edit vendors where permissions allow.

### 4.11 Admin — User Management (ADMIN only)

- Create, edit, deactivate users.
- Assign a **role** per user.
- Configure **module-level permissions** (view / create / edit / delete)
  per module for each user.

**Create a user**
- Admin → User Management → **Create user**.
- Enter name, email, password, role.
- Optional: override module permissions.
- Save. The new user can now log in with those credentials.

---

## 5. Common Operations

### 5.1 CSV / Excel Import

Supported in Inventory, Provisioning, and Reverse Pickup.

1. Open the module's **Import** page.
2. Upload a CSV/Excel file whose first row is the header row with the
   expected column names for that module.
3. Click upload and wait for processing.
4. Review the confirmation message (records created/updated).

> Caution: header names must match the format expected by the module.
> A wrong header is ignored or errors out for that column.

### 5.2 Exporting Reports

Every important table has an **Export** button that downloads the current
(result-filtered) data as an Excel/CSV file. Use it for:
- Inventory, Assigned Assets, Warehouse, Provisioning
- Finance, Logistics, Reverse Pickup
- POD documents

### 5.3 Global Search

Use the search box in the top header to jump to a serial number, order,
request, docket, DC, etc.

---

## 6. Order Lifecycle (Forward Shipment)

```
Order Placed → Allocated → In Provisioning → Docket Requested/Assigned
→ DC Requested/Generated → Packed & Labelled → E-Way Requested/Generated
→ Dispatched → Delivered → Delivery Confirmed → Invoiced → Warranty Updated
```

RTO branch: `RTO → RTO_DC_Requested → RTO_DC_Generated → RTO_E-Way_Requested
→ RTO_E-Way_Generated → RTO_In_Transit → RTO_Delivered_To_Warehouse`.

Cancelled: `CANCELLED` at any stage.

---

## 7. Common Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| Can't open the site (browser) | Server/web-server not running, or your **IP blocked at firewall** — provide your public IP to the admin team for whitelisting. |
| Login page loads but login fails | Wrong email/password; ask Admin to reset. |
| Session logs me out often | The 15-minute idle timeout — just log in again. |
| Import shows errors | Column headers don't match the expected format. |
| Can't see a menu item | Your role has no **view** permission for that module — ask Admin. |
| Can't find a serial number | Check filters/date range; Search using exact serial number. |

---

## 8. Technical Reference (for ops/dev team)

- **Next.js version:** 16.x (App Router, type-safe server actions).
- **Database:** PostgreSQL via Prisma ORM.
- **Deployment:** Docker/Compose. App runs on port **8001 (host) → 3000 (container)**.
- **Env variables used:** `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `UPLOAD_DIR`, `PORT`.
- **File storage:** local `uploads/` folder by default; Supabase storage
  buckets (`pod`, `pod_upload`) when Supabase env vars are configured
  (used for POD documents, Blancco certificates, e-way bill PDFs).
- **Build/run commands:**
  ```bash
  npm install
  npx prisma generate
  npm run dev        # development (http://localhost:3000)
  npm run build && npm start   # production
  npm run lint       # linting
  docker compose up -d --build  # container deployment
  ```
- **API rate limits (middleware):**
  - General API calls: 120/min per IP.
  - Upload endpoints (`/api/upload`, `/api/pods/upload`): 10/min per IP.
  - Exceeded → HTTP 429 "Too many requests".