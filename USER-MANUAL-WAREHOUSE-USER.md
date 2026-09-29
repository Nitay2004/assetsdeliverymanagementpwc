# User Manual — Warehouse / Inventory Operator

**System:** DEV IT Asset Delivery System (Devit)
**For:** Warehouse operator who handles bulk upload, allocation, user assignment, and handover to provisioning/QC.

This is your day-to-day manual. It explains every step in order: how stock comes
into the system, how it gets assigned to users, and how orders move from
**Inventory → Warehouse → Provisioning → QC**.

---

## 0. What you do in short

1. **Bulk upload** laptop stock (CSV/Excel) into Inventory.
2. **Assign users** to assets (single or many at once).
3. **Add orders** and **allocate** stock to those orders.
4. **Send to QC** / assign **QC engineer**.
5. **Advance order to Provisioning** (handover to provisioning team).
6. **Export / search** anytime for reports.

---

## 1. Login

1. Open the system URL in your browser.
2. Enter your **Email** and **Password**.
3. Click **Login** → you land on the **Dashboard (Overview)**.

> Note: the system logs you out automatically after **15 minutes idle** or
> **8 hours** total. Just log in again.

---

## 2. Bulk Upload Stock (Inventory Import)

When you get a stock sheet from the client/courier, import it like this:

1. Go to **Inventory** → click **Import** (top-right).
2. On the import page choose a mode:
   - **Upload New** — creates **new** inventory items.
   - **Update Existing** — updates items already in inventory (matched by serial number).
3. Click the box to **select your CSV / Excel file** (`.csv`, `.xlsx`, `.xls`).
4. Click **"Verify Column Mapping"** — this checks every column in your file:
   - Green badge → this column will be imported correctly.
   - Red badge ("Will be ignored") → that column's data **will be lost**. Fix
     the header name in your file, upload again, and re-verify.
5. When **"All columns mapped"** is shown, click **Import** (or **Update Inventory**).
6. Success screen shows:
   - How many records imported/updated.
   - Any serial numbers **not found** (only in Update mode) — check those separately.
7. Click **View Inventory** to see the imported stock.

**Best practice:** always run **Verify Column Mapping** before Import — this
prevents silent data loss from wrong headers.

---

## 3. Adding Stock Manually (single item)

- **Inventory → New Asset** → fill serial number, model, part no, specs, status → save.
- **Inventory → Add Item** → same, for a full item form.

Use **New Asset**/**Add Item** for 1-off items; use Import for bulk.

---

## 4. Assigning Assets to Users

Two ways:

### 4.1 Single Assign
1. **Inventory → Assign User** (top-right).
2. Tab **Single Assign** → type the **serial number** → click **Search**.
3. You see the asset. Click **Assign to User** (or **Re-Assign to New User** if already assigned).
4. Fill the form:
   - **Employee details:** Partner, Sr #, Entity, Employee Name, Email, Mobile, Alternate Phone.
   - **Shipping Address** + **Pincode** (pincode auto-fills city/state if available).
   - **Purpose, Image Type** (dropdowns — you can even add a new option directly).
   - **Request Date, Count**.
   - **Timeline & SLA:** Email Received Hour (auto-fills **Cut Off Status** and
     **SLA Start Date** automatically), State, Zone, Tier, ODA Location, TAT,
     Delivery TAT Days, SLA Status, Acceptance Date.
   - **Accessories & Setup:** Adaptor Added, Headset/Mouse, Sticker Colour.
5. Click **Save Assignment**.

### 4.2 Multiple Assign (bulk)
1. **Inventory → Assign User** → tab **Multiple Assign**.
2. The system lists all **available** assets. Tick the ones you need (or **Select All**).
3. Click **Assign N Item(s)**.
4. A step-by-step form opens — fill details for the **first** asset, click **Save & Next**,
   fill the next, and so on. Last one says **Assign & Finish**.
5. Done → all selected assets are assigned in one go.

> Multiple Assign reuses the **same typed details** for every asset — it's the
> fastest way to assign a whole batch to users.

---

## 5. Send for QC (Clean & Purge queue)

Before an asset can be provisioned it usually needs QC.

1. Open **Inventory** → open the asset (detail drawer).
2. Click **Send for QC**.
3. Fill the same assignment form (user details + SLA + accessories).
4. Click **Send for QC** → the asset is now **QC_PENDING** and appears in the
   **QC Assignments** tab under Warehouse.

---

## 6. Warehouse — Order Flow (step by step)

**Goal:** a client order arrives → allocate laptops → hand to provisioning.

### 6.1 Add an Order
1. Go to **Warehouse**.
2. Click **Add Order** (top-right).
3. Fill **Client Name, Intermediary, Total Quantity, Delivery Location** → save.
4. The order appears under **Pending Allocation**.

### 6.2 Allocate Stock to the Order
1. In **Pending Allocation**, find the order row.
2. Click **Allocate** (or expand the row).
3. A list of **Available Stock** opens:
   - Search by Serial / Employee / City if the list is long.
   - Tick **exactly** the required number of laptops (`Select N laptop(s)`).
4. Click **Allocate N/N Selected**.
5. You see success: `Laptops successfully allocated to this order!`
6. When all assets are allocated, the row shows **0 Pending** and the button
   changes to **Advance to Provisioning**.

### 6.3 Advance to Provisioning (handover)
1. On a fully allocated order, click **Advance to Provisioning**.
2. In the modal fill three fields (dropdowns, you can add new options too):
   - **Warehouse Location**
   - **Provisioning Location**
   - **Engineer Name**
3. Click **Advance to Provisioning** → order moves to **In Provisioning**.

> **Bulk shortcut:** tick multiple ready orders with the checkboxes, then click
> **Advance to Provisioning** in the top selection bar (saves time on busy days).

### 6.4 QC Assignments tab
- In **Warehouse**, switch to the **QC Assignments** tab (shows a red count badge).
- Assign a **QC engineer** to pending QC items. Engineers complete the Clean/Purge
  on the asset through the system.

---

## 7. Finding and Reviewing Data

- **Search box** (top header) — jump to any serial number / order / DC / docket instantly.
- **Inventory table** — filter by status (New / Available / QC Pending / Allocated),
  search by serial, model, warehouse, tracking status, employee.
- **Detail drawer** — click any inventory row for the full history of that asset.

---

## 8. Exporting Reports

Every module has an **Export** button:
- **Inventory → Export** → downloads today's `inventory-export-YYYY-MM-DD.xlsx`.
- **Inventory → Cases Report** → downloads a `cases-report-YYYY-MM-DD.xlsx`.
- **Warehouse → Export** → warehouse sheet.

Use these for daily MIS / team reporting.

---

## 9. Quick Reference — Button Map

| Where          | Button / Action                        | What it does                            |
|----------------|----------------------------------------|-----------------------------------------|
| Inventory      | **Import**                             | Bulk upload stock (CSV/Excel)           |
| Inventory      | **New Asset / Add Item**               | Add one asset manually                  |
| Inventory      | **Assign User**                        | Assign assets to users (single/multiple)|
| Inventory      | **Send for QC**                        | Queue asset for Clean & Purge QC        |
| Inventory      | **Export** / **Cases Report**          | Download reports                        |
| Warehouse      | **Add Order**                          | Create a client order                   |
| Warehouse      | **Allocate** (row)                     | Assign stock to the order               |
| Warehouse      | **Advance to Provisioning**            | Hand fully-allocated order to provisioning |
| Warehouse      | **QC Assignments** tab                 | Assign QC engineer to pending items     |
| Warehouse      | **Export**                             | Export warehouse data                   |

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| Import says a column "will be ignored" | Rename that header to the correct inventory column name, re-upload, re-verify. |
| Update mode shows "serial not found" | That serial is not in inventory — check spelling or add it via Upload New first. |
| Can't allocate — "No available inventory" | Add laptops first (Import or New Asset). |
| Can't click Advance | All assets must be allocated to the order first (Pending = 0). |
| Order not visible in Pending Allocation | It may already be allocated — check the **Allocated Assets** table below. |
| Allocate button doesn't allow clicking | You selected the wrong count — must select **exactly** the required number. |
| Logged out suddenly | 15-min idle timeout — log in again (data is saved). |

---

*End of manual. If a step looks different on screen, contact the Admin for
confirm — UI is updated from time to time.*