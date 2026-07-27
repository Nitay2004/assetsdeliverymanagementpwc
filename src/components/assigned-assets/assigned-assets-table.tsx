"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowLeftRight } from "lucide-react";
import { getInventoryItem } from "@/app/actions/inventory";
import { InventoryDetailDrawer } from "@/components/inventory/inventory-detail-drawer";
import { UrlDataTableFilter } from "@/components/shared/data-table-filter";

interface LatestAssignment {
  employeeName: string | null;
  emailId: string | null;
  purpose: string | null;
  requestDate: string | null;
  mobileNumber: string | null;
}

interface AssignedItem {
  id: string;
  serialNumber: string;
  model: string;
  specs: string | null;
  status: string;
  partner: string | null;
  sr: number | null;
  entity: string | null;
  userBaseLocation: string | null;
  imageType: string | null;
  purpose: string | null;
  requestDate: string | null;
  count: number | null;
  employeeName: string | null;
  emailId: string | null;
  shippingAddress: string | null;
  landMark: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  mobileNumber: string | null;
  pwcRemarks: string | null;
  laptopMake: string | null;
  laptopModel: string | null;
  invoiceProductDescription: string | null;
  description: string | null;
  emailReceivedHour: string | null;
  cutOffStatus: string | null;
  slaStartDate: string | null;
  slaState: string | null;
  zone: string | null;
  tier: string | null;
  odaLocation: string | null;
  tat: string | null;
  deliveryTatDays: number | null;
  actualDeliveryDate: string | null;
  slaStatus: string | null;
  laptopAcceptanceDate: string | null;
  invoicedQuantity: number | null;
  warrantyPeriod: string | null;
  warrantyEndPeriod: string | null;
  customerInstructionDoc: string | null;
  adaptorAdded: string | null;
  accessoryHeadsetMouse: string | null;
  stickerColour: string | null;
  deliveryDate: string | null;
  dc: string | null;
  vendor: string | null;
  deliveredLocation: string | null;
  docketNumber: string | null;
  trackingStatus: string | null;
  trackingSubStatus: string | null;
  pickupDate: string | null;
  alternatePhoneNumber: string | null;
  processStatus: string | null;
  machineWs1Status: string | null;
  serialNoInWs1: string | null;
  dateOfWs1Update: string | null;
  servicesStartDate: string | null;
  invoicingWarehouse: string | null;
  boxSerialNo: string | null;
  checkField: string | null;
  remark: string | null;
  dcNumber: string | null;
  date: string | null;
  csvStatus: string | null;
  _latestAssignment: LatestAssignment | null;
}

function statusColor(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("delivered") || v.includes("confirmed") || v.includes("received"))
    return "bg-green-100 text-green-700";
  if (v.includes("dispatched") || v.includes("invoiced") || v.includes("payment"))
    return "bg-emerald-100 text-emerald-700";
  if (v.includes("allocated"))
    return "bg-blue-100 text-blue-700";
  if (v.includes("provisioning") || v.includes("dc generated") || v.includes("packed") || v.includes("labelled"))
    return "bg-indigo-100 text-indigo-700";
  if (v.includes("docket") || v.includes("eway"))
    return "bg-cyan-100 text-cyan-700";
  if (v.includes("placed") || v.includes("pending"))
    return "bg-yellow-100 text-yellow-700";
  if (v.includes("order"))
    return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export function AssignedAssetsTable({
  items,
  selectedId,
  totalCount,
  currentPage,
  pageSize,
}: {
  items: AssignedItem[];
  selectedId?: string;
  totalCount: number;
  currentPage: number;
  pageSize: number;
}) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<AssignedItem | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    const match = items.find((i) => i.id === selectedId);
    if (match) {
      queueMicrotask(() => setSelectedItem(match));
      cleanupUrl();
      return;
    }
    getInventoryItem(selectedId).then((item) => {
      if (item) {
        setSelectedItem(item as unknown as AssignedItem);
        cleanupUrl();
      }
    });
    function cleanupUrl() {
      const url = new URL(window.location.href);
      url.searchParams.delete("selected");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [selectedId, items]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  return (
    <div className="relative">
      <div className="px-6 py-4 border-b">
        <UrlDataTableFilter placeholder="Search by serial no, model, employee, email, city, tracking status..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
            <tr>
              <th className="px-4 py-4 font-semibold">Serial Number</th>
              <th className="px-4 py-4 font-semibold">Model</th>
              <th className="px-4 py-4 font-semibold">Employee Name</th>
              <th className="px-4 py-4 font-semibold">Email</th>
              <th className="px-4 py-4 font-semibold">Purpose</th>
              <th className="px-4 py-4 font-semibold">Tracking Status</th>
              <th className="px-4 py-4 font-semibold">Location</th>
              <th className="px-4 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-8 text-center text-muted-foreground"
                >
                  No allocated assets found.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const a = item._latestAssignment;
                const empName = a?.employeeName ?? item.employeeName;
                const empEmail = a?.emailId ?? item.emailId;
                const purpose = a?.purpose ?? item.purpose;
                const location = [item.city, item.state]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="transition-colors cursor-pointer hover:bg-muted/10"
                  >
                    <td className="px-4 py-4 font-medium whitespace-nowrap">
                      {item.serialNumber}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">{item.model}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {empName || "—"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                      {empEmail || "—"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {purpose || "—"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {item.trackingStatus ? (
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor(item.trackingStatus)}`}
                        >
                          {item.trackingStatus}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                      {location || "—"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            const params = new URLSearchParams();
                            if (item.serialNumber) params.set("serialNumber", item.serialNumber);
                            if (item.model) params.set("model", item.model);
                            if (item.entity) params.set("entity", item.entity);
                            if (item.imageType) params.set("imageType", item.imageType);
                            if (empName) params.set("employeeName", empName);
                            if (empEmail) params.set("emailId", empEmail);
                            if (item.mobileNumber) params.set("mobileNumber", item.mobileNumber);
                            if (item.shippingAddress) params.set("shippingAddress", item.shippingAddress);
                            if (item.landMark) params.set("landMark", item.landMark);
                            if (item.city) params.set("city", item.city);
                            if (item.state) params.set("state", item.state);
                            if (item.pinCode) params.set("pinCode", item.pinCode);
                            router.push(`/dashboard/reverse-pickup/add?${params.toString()}`);
                          }}
                          className="flex items-center gap-1.5 rounded-md bg-red-50 text-red-700 px-2.5 py-1 text-xs font-semibold hover:bg-red-100 transition-colors"
                          title="Initiate Reverse Pickup"
                        >
                          <ArrowLeftRight className="size-3.5" />
                          Reverse Pickup
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              router.push(
                `/dashboard/assigned-assets?page=1&limit=${e.target.value}`
              );
            }}
            className="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>
            {totalCount === 0
              ? "0 items"
              : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalCount)} of ${totalCount}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              router.push(
                `/dashboard/assigned-assets?page=${safePage - 1}&limit=${pageSize}`
              )
            }
            disabled={safePage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-3 text-sm text-muted-foreground">
            Page {safePage} of {totalPages}
          </span>
          <button
            onClick={() =>
              router.push(
                `/dashboard/assigned-assets?page=${safePage + 1}&limit=${pageSize}`
              )
            }
            disabled={safePage >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {selectedItem && (
        <InventoryDetailDrawer
          item={selectedItem}
          isAdmin={false}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
