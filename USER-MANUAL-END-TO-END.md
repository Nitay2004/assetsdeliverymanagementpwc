# Asset Delivery System — Complete End-to-End Process Manual

**System:** DEV IT Asset Delivery System (Devit)
**Covers:** Every module and role — the full forward (delivery) journey **and** the
reverse (return) journey, from the first bulk upload to the final warranty update.

---

## 1. System & Roles at a Glance

| Role | Does what in the system |
|------|-------------------------|
| WAREHOUSE | Bulk upload stock, assign users, create orders, allocate, advance to provisioning, QC assignments |
| PROVISIONING | OS install, asset QC work, hand orders over to logistics |
| FINANCE | Generate Delivery Challans (DC) + E-Way bills (forward & reverse) |
| LOGISTICS | Dockets (AWB), packing, dispatch, delivery, POD documents |
| WARRANTY | Warranty / support info after delivery |
| REVERSE_PICKUP | Create/manage return pickup requests & their journey back |
| PWC | Read-only monitoring of everything |
| ADMIN | All modules + user/permission management |

> A role only **sees** the modules it has permission for (left sidebar). A user can only
> press the buttons their permission allows (view/create/edit/delete). ADMIN sees/does everything.

---

## 2. The Big Picture — End-to-End Flow

```
FORWARD (deliver a laptop to a user):

  Bulk upload stock          Assign user / Send QC
  (Inventory > Import)  ───► Inventory ───► Warehouse order + Allocate
                                                   │
                                                   ▼
                                    Advance to Provisioning
                                                   │
                                                   ▼
                 Provisioning: OS install → Handed over to Logistics
                                                   │
                                                   ▼
                 Logistics: Add Docket → Finance: Generate DC → E-Way Bill
                                                   │
                                                   ▼
                            Packed & Labelled → Dispatched → Delivered
                                                   │
                                                   ▼
                            Delivery Confirmed → Invoiced → Warranty Updated


REVERSE (laptop comes back from a user):

  Reverse Pickup > Add request/Import
        │  Partner assigned → Inspected → Picked Up → In Transit
        ▼
  Received at Warehouse → QC (Clean & Purge) → Blancco Certified
        │
        ▼
  Finance: Generate DC → E-Way Bill → Completed
```

---

## 3. FORWARD FLOW — Step by Step

### STEP 1 — Inventory Module (Warehouse / Admin)

This is where every asset lives and gets prepared.

**1.1 Bulk upload your stock**
1. **Inventory → Import**.
2. Choose **Upload New** (create items) or **Update Existing** (edit items by serial no).
3. Pick the CSV / Excel file (`.csv`, `.xlsx`, `.xls`).
4. Click **Verify Column Mapping** — every green row maps to a field; a red
   "Will be ignored" row means that column's data **will be lost**. Fix headers
   and re-verify before proceeding.
5. Click **Import** (or **Update Inventory**). Read the summary:
   - records imported/updated,
   - serials **not found** in Update mode,
   - row-level errors.
6. **View Inventory** to confirm.

**1.2 Add a single asset**
- **New Asset** (quick) or **Add Item** (full form) → serial, model, part no, specs, status.

**1.3 Assign assets to users**
- **Assign User** button:
  - **Single Assign** → type serial → Search → **Assign to User** → fill the form → **Save Assignment**.
  - **Multiple Assign** → tick assets (or Select All) → **Assign N Item(s)** →
    fill step 1 → **Save & Next** → … → **Assign & Finish**.
- Form essentials: employee name/email/mobile, shipping address + pincode,
  purpose, image type, email received hour (auto-fills cut-off & SLA start
  date), zone/tier/TAT, accessories (adaptor, headset/mouse, sticker colour).

**1.4 Send asset for QC**
- From the asset detail → **Send for QC** → same form → asset becomes `QC_PENDING`
  and shows in Warehouse → **QC Assignments**.

**1.5 Reports**
- **Export** → `inventory-export-<date>.xlsx` · **Cases Report** → `cases-report-<date>.xlsx`.

---

### STEP 2 — Warehouse Module (Warehouse / Admin)

**2.1 Create an order**
- **Add Order** → client name, intermediary, total quantity, delivery location → save.
- Order appears under **Pending Allocation**.

**2.2 Allocate stock to the order**
- In **Pending Allocation** click **Allocate** on the order row.
- Tick exactly `N` laptops from Available Stock (search by serial/employee/city).
- Click **Allocate N/N Selected**. When done → **Pending = 0**.

**2.3 Advance to Provisioning** (handover to OS-install team)
- Click **Advance to Provisioning** and fill:
  - **Warehouse Location**, **Provisioning Location**, **Engineer Name** (dropdowns).
- Order moves to `IN_PROVISIONING`.
- **Bulk:** tick several ready orders → **Advance to Provisioning** on the top bar.

**2.4 QC Assignments tab**
- Switch tab (red count badge). Assign a **QC engineer** to pending items;
  engineers record Clean & Purge results in Provisioning → QC work.

---

### STEP 3 — Provisioning Module (Provisioning / Admin)

Engineer's workbench. Orders are grouped **Unassigned** then **by engineer**; use the
engineer filter chips to see your own queue.

**3.1 Mark OS installed**
- In a row, click **Mark OS Installed** (asset status: allocated → os_installed).
- **Bulk:** tick multiple asset rows → **Mark OS Installed** on the top bar.

**3.2 QC work**
- Switch to **QC Assignments** tab → it shows only items where the logged-in user
  is the assigned QC engineer. Record **Clean** and **Purge** results/remarks → Complete.

**3.3 Hand over to Logistics**
- Once OS is installed, click **Handed over to Logistics**
  (order status → `DOCKET_REQUESTED`; the row now shows the green "Handed Over" tag).
- **Bulk:** tick rows → **Handed over to Logistics**.

**3.4 Import / Edit / Undo**
- **Import** — bulk import provisioning/asset data (engineer, condition, rack, lots…).
- ✏️ Edit — change warehouse location / provisioning location / engineer.
- ↺ **Remove from provisioning** — send an order back to warehouse.

---

### STEP 4 — Finance Module (Finance / Admin)

Makes an order dispatchable by generating documents.

**4.1 Generate a Delivery Challan (DC)**
- Orders awaiting finance appear in the table (status `DC_REQUESTED` / `IN_PROVISIONING` etc.).
- Click the row action to open **Generate Delivery Challan**:
  - **Warehouse Location**, **Ship To** (auto from order), **Bill To** (dropdown).
  - Reference details (mode of payment, ref no/date, buyer's order, dispatch doc no, etc.).
  - **Item Details** table (description, HSN/SAC, qty, rate) — amount & IGST 18% auto-calc.
- Click **Generate DC & Download PDF** → DC created **and** the PDF opens automatically.
- Order status → `DC_GENERATED`.

**Reverse pickup DC differences** (`STEP RP-4`)
- The PDF is titled **REVERSE PICKUP DELIVERY CHALLAN** instead of DELIVERY CHALLAN.
- **Mode / Terms of Payment is not captured** on a reverse DC.
- **HSN/SAC auto-fills from Product Master** — the request's serial number is
  resolved against inventory to get the part number, then matched to the HSN on
  the product (model name is the fallback).
- **Dispatched Through auto-fills** with the pickup partner assigned on the
  reverse request, since the return leg travels back through them.

**4.2 E-Way Bill**
- Enter the E-Way bill number against the order (and upload the document if available).

**4.3 Reverse Pickup — Finance Actions** (bottom section)
- Requests with status **DC Requested** → **Generate DC** (opens Reverse Pickup DC modal) → PDF.
- Requests with status **E-Way Bill Req.** → type E-Way # → **Generate** → optional file attachment.

**4.4 Export** → finance report.

---

### STEP 5 — Logistics Module (Logistics / Admin)

Owns docket, packing, dispatch, delivery & POD.

**5.1 Assign the docket (courier AWB)**
- For orders in **DOCKET_REQUESTED**: click **+ Add Docket** → enter **Docket #**
  (+ optional **E-Way Bill #**) → **Save** → status `DOCKET_ASSIGNED`.

**5.2 Move the order through dispatch stages**
- Each order card has an **Advance** button that walks the order forward one stage at a time:

```
DC Generated → Packed & Labelled → Docket Assigned → E-Way Req → E-Way Gen → Dispatched → Delivered
```

- Click it as each physical step happens; a confirm dialog asks before advancing.

**5.3 POD (Proof of Delivery)**
- Upload the POD document (PDF/JPG/PNG) against the order; **Pod Export** downloads PODs in bulk.

**5.4 Reverse Pickup dockets**
- Requests with **DOCKET_REQUESTED** appear in the **Reverse Pickup Docket** section —
  assign the courier docket for the return leg.
- This queue opens only **after** the DC and the E-Way bill are generated.

**5.5 Export** → logistics report.

---

### STEP 6 — After Delivery

- **Delivered** → **Delivery Confirmed** (confirm with user) → **Invoiced** → **Warranty Updated**.

### STEP 6a — Warranty Module (Warranty / Admin)
- Lists ALLOCATED / AVAILABLE items.
- Cards show: Total Items, Warranty Set, **Needs Warranty**.
- Edit each row → set **Warranty Period** and **Warranty End Period**.

### STEP 6b — Assigned Assets (view)
- Shows every currently **allocated** asset (employee, email, purpose, tracking, SLA…).
- Stats: Total Allocated, Unique Employees, Top Model. Export available.
- Read-only for most roles; used by LOGISTICS & management to check assignments.

---

## 4. REVERSE FLOW — Return Pickup, Step by Step

### STEP RP-1 — Create the return request (Reverse Pickup / Admin)
- **Reverse Pickup → Add**:
  - Employee details + last working day.
  - **Serial number** (model auto-links from inventory), accessories, reason.
  - **Pickup address** (address, landmark, city, state, pincode).
- Save → a **Request Number** is generated automatically.
- **Bulk:** Reverse Pickup → **Import** to register many returns from a file.

### STEP RP-2 — Pickup journey
The request status moves as the pickup happens. Update it in the request detail:

```
Requested → Partner Assigned → DC Requested → DC Generated
   → E-Way Bill Requested → E-Way Bill Generated
   → Docket Requested → Docket Assigned
   → Inspected → Picked Up → In Transit → Received at Warehouse
```

**Special statuses you may need:**
`PICKUP_CANCELLED` · `DUPLICATE` · `ALREADY_SUBMITTED_TO_PWC_OFFICE` · `PENDING` ·
`PWC_CONFIRMATION_AWAITED` · `GATEPASS_PENDING` · `ALIGN_FOR_PICKUP` · `ON_HOLD` ·
`RTO_CASE` · `LOST_DEVICE`

### STEP RP-3 — Warehouse receipt & QC
- On **Received at Warehouse**: record **Received Date**, **Received By**.
- **QC** — two stages:
  - **Hardware QC**: result + remarks + date + performed by → `QC_CLEANED`.
  - **Software QC**: result + remarks + date + performed by → `QC_COMPLETED`.
- **Blancco** — two stages:
  - **Blanco Clear**: result + remarks + date + performed by → `BLANCO_CLEARED`.
  - **Blanco Purge**: result + remarks + date + performed by + upload the
    **Blancco Certificate PDF** → `BLANCO_PURGED` → then **Move Back to Inventory**.

### STEP RP-4 — Finance (DC + E-Way), Logistics (Docket) & completion
1. After **Partner Assigned**, click **Request DC from Finance** → status `DC_REQUESTED` →
   appears in **Finance → Reverse Pickup Finance Actions**.
2. Finance clicks **Generate DC** (Reverse Pickup DC modal) → DC created, PDF/Cert stored → `DC_GENERATED`.
3. Status → `EWAY_BILL_REQUESTED` → Finance enters **E-Way #** (+ attachment) → `EWAY_BILL_GENERATED`.
4. Click **Request Docket from Logistics** → `DOCKET_REQUESTED` → Logistics enters the docket in
   **Logistics → Reverse Pickup Docket** → `DOCKET_ASSIGNED`.
5. Once the asset is received at the warehouse (`RECEIVED_AT_WAREHOUSE`) the
   **POD document upload** unlocks in the request detail view.
6. Request → **Completed**. ✔

---

## 5. Status Glossary (Forward Orders)

| Status | Meaning | Who sets it |
|--------|---------|-------------|
| ORDER_PLACED | Order created, waiting allocation | Warehouse |
| ALLOCATED | Stock assigned to order | Warehouse |
| IN_PROVISIONING | With OS-install team | Warehouse (Advance) |
| DOCKET_REQUESTED | Handed to logistics, needs docket | Provisioning |
| DOCKET_ASSIGNED | Courier AWB saved | Logistics |
| DC_REQUESTED / DC_GENERATED | Challan requested / created (+PDF) | Provisioning→Finance |
| PACKED_AND_LABELLED | Boxed & labelled | Logistics |
| EWAY_BILL_REQUESTED / GENERATED | E-Way bill number entered | Logistics / Finance |
| DISPATCHED | Left warehouse | Logistics |
| DELIVERED | Reached user | Logistics |
| DELIVERY_CONFIRMED | User confirmed | Finance/Logistics |
| INVOICED | Invoiced | Finance |
| WARRANTY_UPDATED | Warranty recorded | Warranty |
| RTO (+sub-stages) | Return to origin — DC / E-Way / In Transit / Delivered to Warehouse | Logistics/Finance |
| CANCELLED | Order cancelled | Admin |

---

## 6. Reverse Pickup Status Glossary

| Status | Meaning |
|--------|---------|
| REQUESTED | Return registered |
| PARTNER_ASSIGNED | Pickup partner assigned |
| INSPECTED | Asset checked at pickup |
| PICKED_UP | Courier took it |
| IN_TRANSIT | On the way back |
| RECEIVED_AT_WAREHOUSE | Received at warehouse |
| DOCKET_REQUESTED / DOCKET_ASSIGNED | Docket asked from / given by Logistics |
| DC_REQUESTED / DC_GENERATED | Challan workflow |
| EWAY_BILL_REQUESTED / GENERATED | E-Way workflow |
| QC_CLEANED | Hardware QC done |
| QC_COMPLETED | Software QC done |
| BLANCO_CLEARED | Blancco Clear done |
| BLANCO_PURGED | Blancco Purge done + certificate |
| COMPLETED | Fully processed |

> **Overall QC result:** `qcResult` is `FAIL` when Hardware QC **or** Software QC fails,
> and `PASS` only when both pass. A failed QC blocks the Blancco Clear/Purge stage.

---

## 7. Reports & Exports (used by every team daily)

| Module | Export gives you |
|--------|------------------|
| Inventory | Full stock + assignments (xlsx) |
| Inventory (Cases) | Per-case status report |
| Assigned Assets | Allocated list by employee |
| Warehouse | Allocation/provisioning sheet |
| Provisioning | Provisioning status sheet |
| Finance | Forward + reverse financials |
| Logistics | Dispatch/docket/POD data |
| Reverse Pickup | Return request register |

Use the **global search** (top bar) to jump anywhere by serial number, order,
DC, docket, or request number.

---

## 8. Tips & Troubleshooting

| Situation | What to do |
|-----------|------------|
| Import column "ignored" | Rename header to a known field, re-upload, re-verify. |
| Update shows "serial not found" | Serial isn't in inventory — Upload New it first. |
| Can't allocate (no stock) | Import/Add assets first. |
| Allocate button disabled | Must select **exactly** the required count. |
| Can't see a module in sidebar | Your role lacks **view** permission → ask Admin. |
| DC PDF doesn't open | Pop-up blocked — allow pop-ups for the site. |
| E-Way/DC request not visible in Finance | Status must be the right one — check glossary. |
| Logged out | 15-min idle timeout — log back in (data is saved). |
| API/server unreachable | Check your **public IP** is whitelisted / server web service is up. |

---

*This manual covers the complete lifecycle. Keep it with the team; if the UI adds
or renames a button, ask Admin to update this document.*