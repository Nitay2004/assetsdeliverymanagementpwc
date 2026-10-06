"use server";

import { prisma } from "@/lib/prisma";
import { getSession, requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { syncOrderTrackingStatus } from "@/app/actions/warehouse";
import { nextSequenceNumber } from "@/lib/sequence-number";

function numberToWords(num: number): string {
  if (num === 0) return "Zero";

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertBelow1000(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convertBelow1000(n % 100) : "");
  }

  function convertBelow10000000(n: number): string {
    if (n < 1000) return convertBelow1000(n);
    if (n < 100000) return convertBelow1000(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convertBelow1000(n % 1000) : "");
    if (n < 10000000) return convertBelow1000(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convertBelow1000(n % 1000) : "");
    return "";
  }

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const remainder = num % 1000;

  let result = "";
  if (crore > 0) result += convertBelow1000(crore) + " Crore ";
  if (lakh > 0) result += convertBelow1000(lakh) + " Lakh ";
  if (thousand > 0) result += convertBelow1000(thousand) + " Thousand ";
  if (remainder > 0) result += convertBelow1000(remainder);

  return result.trim();
}

export async function getNextDcNumber(): Promise<string> {
  await requireAuth();
  const now = new Date();
  const year = now.getFullYear();
  const shortYear = year % 100;
  const nextShortYear = (year + 1) % 100;
  const fy = `${String(shortYear).padStart(2, "0")}-${String(nextShortYear).padStart(2, "0")}`;

  const nextSeq = await nextSequenceNumber({
    table: "delivery_challans",
    column: "dc_number",
    valuePattern: /^DC-PDH-([0-9]+)-\d{2}-\d{2}$/,
  });

  return `DC-PDH-${String(nextSeq).padStart(4, "0")}-${fy}`;
}

export async function getWarehouses() {
  await requireAuth();
  return prisma.warehouse.findMany({ orderBy: { name: "asc" } });
}

export async function createWarehouse(name: string, location?: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canCreate");
  return prisma.warehouse.create({ data: { name, location } });
}

export async function deleteWarehouse(id: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canDelete");
  try {
    await prisma.warehouse.delete({ where: { id } });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2003") {
      throw new Error("Cannot delete warehouse: it is linked to existing DCs.");
    }
    throw err;
  }
  revalidatePath("/dashboard/finance");
  return { ok: true };
}

export interface DcFormData {
  warehouseId?: string;
  warehouseLocation?: string;
  shipToLocation: string;
  billToLocation: string;
  modeOfPayment: string;
  referenceNo: string;
  referenceDate?: string;
  otherReferences: string;
  buyersOrderNo: string;
  buyersOrderDate?: string;
  dispatchDocNo: string;
  dispatchedThrough: string;
  destination: string;
  termsOfDelivery: string;
  items: {
    description: string;
    hsnSac: string;
    quantity: number;
    rate: number;
  }[];
}

export async function generateDC(orderId: string, data: DcFormData) {
  const user = await getSession();
  requirePermission(user, "finance", "canCreate");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      assets: {
        include: { inventoryItem: true },
      },
    },
  });
  if (!order) throw new Error("Order not found");

  const isRto = order.status === "RTO_DC_REQUESTED";
  const targetStatus = isRto ? "RTO_DC_GENERATED" : "DC_GENERATED";
  const trackingStatus = isRto ? "RTO_DC_GENERATED" : "DC_GENERATED";

  const dcNumber = await getNextDcNumber();
  const dcDate = new Date();

  // Product Master stays the source of truth for the HSN: whatever the browser
  // sent only fills in when the product has no HSN on file.
  const hsnByModel: Record<string, string> = {};
  for (const a of order.assets) {
    if (!a.inventoryItem) continue;
    const modelKey = (a.inventoryItem.model || "").trim().toLowerCase();
    if (modelKey && hsnByModel[modelKey] === undefined) {
      hsnByModel[modelKey] = (await lookupProductHsn(a.inventoryItem.partNo, a.inventoryItem.model)) ?? "";
    }
  }

  const items = data.items.map((item) => {
    const amount = item.quantity * item.rate;
    const taxableValue = amount;
    return {
      ...item,
      hsnSac: item.hsnSac || hsnByModel[(item.description || "").trim().toLowerCase()] || "",
      amount,
      taxableValue,
    };
  });

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const totalTaxableValue = items.reduce((sum, i) => sum + i.taxableValue, 0);
  const igstRate = items[0]?.hsnSac ? 18 : 0;
  const igstAmount = totalTaxableValue * (igstRate / 100);
  const totalTaxAmount = igstAmount;
  const amountInWords = numberToWords(Math.round(totalAmount)) + " Only";
  const taxAmountInWords = numberToWords(Math.round(totalTaxAmount)) + " Only";

  const dc = await prisma.deliveryChallan.create({
    data: {
      orderId,
      dcNumber,
      dcDate,
      warehouseId: data.warehouseId || null,
      shipToLocation: data.shipToLocation,
      billToLocation: data.billToLocation,
      modeOfPayment: data.modeOfPayment || null,
      referenceNo: data.referenceNo,
      referenceDate: data.referenceDate ? new Date(data.referenceDate) : null,
      otherReferences: data.otherReferences,
      buyersOrderNo: data.buyersOrderNo,
      buyersOrderDate: data.buyersOrderDate ? new Date(data.buyersOrderDate) : null,
      dispatchDocNo: data.dispatchDocNo,
      dispatchedThrough: data.dispatchedThrough,
      destination: data.destination,
      termsOfDelivery: data.termsOfDelivery,
      amountInWords,
      taxableValue: totalTaxableValue,
      igst: igstAmount,
      totalTaxAmount,
      taxAmountInWords,
      items: {
        create: items.map((item) => ({
          description: item.description,
          hsnSac: item.hsnSac,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          taxableValue: item.taxableValue,
          igstRate,
          igstAmount,
        })),
      },
    },
    include: { items: true },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { dcNumber, status: targetStatus },
  });

  await syncOrderTrackingStatus(orderId, trackingStatus);

  const linkedAssets = await prisma.asset.findMany({
    where: { orderId, inventoryItemId: { not: null } },
    select: { inventoryItemId: true },
  });
  const linkedItemIds = linkedAssets.map(a => a.inventoryItemId).filter(Boolean) as string[];
  if (linkedItemIds.length > 0) {
    await prisma.inventoryItem.updateMany({
      where: { id: { in: linkedItemIds } },
      data: { dcNumber },
    });
  }

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/inventory");

  return { ...dc, taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null, igst: dc.igst ? Number(dc.igst) : null, totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null, items: dc.items.map(i => ({ ...i, rate: Number(i.rate), amount: Number(i.amount), taxableValue: i.taxableValue ? Number(i.taxableValue) : null, igstRate: i.igstRate ? Number(i.igstRate) : null, igstAmount: i.igstAmount ? Number(i.igstAmount) : null })) };
}

export async function getDC(dcId: string) {
  await requireAuth();
  const dc = await prisma.deliveryChallan.findUnique({
    where: { id: dcId },
    include: {
      items: true,
      warehouse: true,
      order: true,
    },
  });
  if (!dc) return null;
  return {
    ...dc,
    taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null,
    igst: dc.igst ? Number(dc.igst) : null,
    totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
    items: dc.items.map(i => ({
      ...i,
      rate: Number(i.rate),
      amount: Number(i.amount),
      taxableValue: i.taxableValue ? Number(i.taxableValue) : null,
      igstRate: i.igstRate ? Number(i.igstRate) : null,
      igstAmount: i.igstAmount ? Number(i.igstAmount) : null,
    })),
  };
}

export async function getDCsByOrder(orderId: string) {
  await requireAuth();
  const dcs = await prisma.deliveryChallan.findMany({
    where: { orderId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return dcs.map(dc => ({
    ...dc,
    taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null,
    igst: dc.igst ? Number(dc.igst) : null,
    totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
    items: dc.items.map(i => ({
      ...i,
      rate: Number(i.rate),
      amount: Number(i.amount),
      taxableValue: i.taxableValue ? Number(i.taxableValue) : null,
      igstRate: i.igstRate ? Number(i.igstRate) : null,
      igstAmount: i.igstAmount ? Number(i.igstAmount) : null,
    })),
  }));
}

// ─── Reverse Pickup DC ───

// A delivery challan line only carries a model name, while the HSN code lives
// in Product Master. Forward DCs are keyed on the inventory part number; a
// reverse pickup request only stores a serial and a model name, so its serial
// is resolved against inventory first with the model name as fallback.
async function lookupProductHsn(partNo?: string | null, modelName?: string | null): Promise<string | null> {
  if (partNo) {
    const byPartNo = await prisma.productMaster.findFirst({
      where: { partNo: { equals: partNo, mode: "insensitive" } },
      select: { hsnCode: true },
    });
    if (byPartNo?.hsnCode) return byPartNo.hsnCode;
  }
  if (modelName) {
    const byModel = await prisma.productMaster.findFirst({
      where: { model: { equals: modelName, mode: "insensitive" } },
      select: { hsnCode: true },
    });
    if (byModel?.hsnCode) return byModel.hsnCode;
  }
  return null;
}

async function resolveProductHsn(serialNumber: string | null, model: string | null): Promise<string | null> {
  const serial = serialNumber?.trim();
  if (serial) {
    const item = await prisma.inventoryItem.findUnique({
      where: { serialNumber: serial },
      select: { partNo: true, model: true },
    });
    const hsn = await lookupProductHsn(item?.partNo, item?.model);
    if (hsn) return hsn;
  }

  return lookupProductHsn(null, model?.trim());
}

export async function getReversePickupForDc(rpId: string) {
  await requireAuth();
  const rp = await prisma.reversePickupRequest.findUnique({
    where: { id: rpId },
  });
  if (!rp) return null;

  const fullAddress = [rp.pickupAddress, rp.city, rp.state, rp.pinCode].filter(Boolean).join(", ");
  const hsnCode = await resolveProductHsn(rp.serialNumber, rp.model);

  return {
    id: rp.id,
    clientName: rp.employeeName,
    totalQuantity: 1,
    deliveryLocation: fullAddress || rp.pickupAddress,
    fullAddress: fullAddress || rp.pickupAddress,
    warehouseLocation: rp.warehouseLocation || "",
    docketNumber: "",
    // Reverse pickup is a return leg, so the DC leaves through the same pickup
    // partner that collected the asset rather than a forward courier.
    partnerName: rp.partnerName || "",
    items: [{ description: rp.model || "Laptop", hsnSac: hsnCode ?? "", quantity: 1, rate: 0 }],
  };
}

export async function generateReversePickupDc(rpId: string, data: DcFormData) {
  const user = await getSession();
  requirePermission(user, "finance", "canCreate");

  const rp = await prisma.reversePickupRequest.findUnique({ where: { id: rpId } });
  if (!rp) throw new Error("Reverse pickup request not found");

  const dcNumber = await getNextDcNumber();
  const dcDate = new Date();

  // Product Master stays the source of truth for the HSN: whatever the browser
  // sent only fills in when the product has no HSN on file.
  const resolvedHsn = await resolveProductHsn(rp.serialNumber, rp.model);

  const items = data.items.map((item) => {
    const amount = item.quantity * item.rate;
    const taxableValue = amount;
    return { ...item, hsnSac: item.hsnSac || resolvedHsn || "", amount, taxableValue };
  });

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const totalTaxableValue = items.reduce((sum, i) => sum + i.taxableValue, 0);
  const igstRate = items[0]?.hsnSac ? 18 : 0;
  const igstAmount = totalTaxableValue * (igstRate / 100);
  const totalTaxAmount = igstAmount;
  const amountInWords = numberToWords(Math.round(totalAmount)) + " Only";
  const taxAmountInWords = numberToWords(Math.round(totalTaxAmount)) + " Only";

  const dc = await prisma.deliveryChallan.create({
    data: {
      reversePickupRequestId: rpId,
      dcNumber,
      dcDate,
      warehouseId: data.warehouseId || null,
      shipToLocation: data.shipToLocation,
      billToLocation: data.billToLocation,
      // Reverse pickup DCs are raised on a return leg, so there is no payment
      // term to capture.
      modeOfPayment: null,
      referenceNo: data.referenceNo,
      referenceDate: data.referenceDate ? new Date(data.referenceDate) : null,
      otherReferences: data.otherReferences,
      buyersOrderNo: data.buyersOrderNo,
      buyersOrderDate: data.buyersOrderDate ? new Date(data.buyersOrderDate) : null,
      dispatchDocNo: data.dispatchDocNo,
      // Dispatched Through is pre-filled in the modal with the pickup partner
      // from the request, but the dropdown stays usable for requests that have
      // no partner recorded, so whatever was chosen wins.
      dispatchedThrough: data.dispatchedThrough || rp.partnerName,
      destination: data.destination,
      termsOfDelivery: data.termsOfDelivery,
      amountInWords,
      taxableValue: totalTaxableValue,
      igst: igstAmount,
      totalTaxAmount,
      taxAmountInWords,
      items: {
        create: items.map((item) => ({
          description: item.description,
          hsnSac: item.hsnSac,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          taxableValue: item.taxableValue,
          igstRate,
          igstAmount,
        })),
      },
    },
    include: { items: true },
  });

  await prisma.reversePickupRequest.update({
    where: { id: rpId },
    data: { dcNo: dcNumber, status: "DC_GENERATED" },
  });

  if (rp.inventoryItemId) {
    await prisma.inventoryItem.update({
      where: { id: rp.inventoryItemId },
      data: { dcNumber },
    });
  }

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/reverse-pickup");
  revalidatePath("/dashboard/inventory");

  return { ...dc, taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null, igst: dc.igst ? Number(dc.igst) : null, totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null, items: dc.items.map(i => ({ ...i, rate: Number(i.rate), amount: Number(i.amount), taxableValue: i.taxableValue ? Number(i.taxableValue) : null, igstRate: i.igstRate ? Number(i.igstRate) : null, igstAmount: i.igstAmount ? Number(i.igstAmount) : null })) };
}

// ─── Docket Number on DC ───

export async function updateDcDocket(docketId: string, docketNumber: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canEdit");
  const value = docketNumber.trim();
  if (!value) throw new Error("Docket number is required.");

  const docket = await prisma.docket.update({
    where: { id: docketId },
    data: { docketNumber: value },
  });

  if (docket.orderId) {
    const linkedAssets = await prisma.asset.findMany({
      where: { orderId: docket.orderId, inventoryItemId: { not: null } },
      select: { inventoryItemId: true },
    });
    const linkedItemIds = linkedAssets.map(a => a.inventoryItemId).filter(Boolean) as string[];
    if (linkedItemIds.length > 0) {
      await prisma.inventoryItem.updateMany({
        where: { id: { in: linkedItemIds } },
        data: { docketNumber: value },
      });
    }
  }

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");

  return { ok: true };
}

// ─── Dispatched Through Dropdown ───

export async function getDispatchedThroughOptions() {
  await requireAuth();
  const options = await prisma.dropdownOption.findMany({
    where: { category: "dispatchedThrough" },
    orderBy: { value: "asc" },
  });
  return options.map(o => ({ id: o.id, value: o.value }));
}

export async function addDispatchedThroughOption(value: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canCreate");
  await prisma.dropdownOption.upsert({
    where: { category_value: { category: "dispatchedThrough", value } },
    update: {},
    create: { category: "dispatchedThrough", value },
  });
}

export async function deleteDispatchedThroughOption(id: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canDelete");
  await prisma.dropdownOption.delete({ where: { id } });
}

// ─── Bill To Location Dropdown ───

export async function getBillToLocationOptions() {
  await requireAuth();
  const options = await prisma.dropdownOption.findMany({
    where: { category: "billToLocation" },
    orderBy: { value: "asc" },
  });
  return options.map(o => ({ id: o.id, value: o.value }));
}

export async function addBillToLocationOption(value: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canCreate");
  await prisma.dropdownOption.upsert({
    where: { category_value: { category: "billToLocation", value } },
    update: {},
    create: { category: "billToLocation", value },
  });
}

export async function deleteBillToLocationOption(id: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canDelete");
  await prisma.dropdownOption.delete({ where: { id } });
}

export async function getOrderForDc(orderId: string) {
  await requireAuth();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      assets: {
        include: { inventoryItem: true },
      },
      dockets: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!order) return null;

  const productItems = await Promise.all(
    order.assets
      .filter(a => a.inventoryItem)
      .map(async a => ({
        description: a.inventoryItem!.model || "",
        hsnSac: (await lookupProductHsn(a.inventoryItem!.partNo, a.inventoryItem!.model)) ?? "",
        quantity: 1,
        rate: 0,
      }))
  );

  const warehouse = order.warehouseLocation || "";

  // Build full user address from inventory item
  const inv = order.assets.find(a => a.inventoryItem)?.inventoryItem;
  const fullAddress = inv
    ? [inv.shippingAddress, inv.city, inv.state, inv.pinCode].filter(Boolean).join(", ")
    : order.deliveryLocation;

  const docketNumber = order.dockets[0]?.docketNumber || "";
  const dispatchCourier = order.dockets[0]?.courierName || "";

  return {
    id: order.id,
    clientName: order.clientName,
    totalQuantity: order.totalQuantity,
    deliveryLocation: order.deliveryLocation,
    fullAddress,
    warehouseLocation: warehouse,
    docketNumber,
    dispatchCourier,
    items: productItems.length > 0 ? productItems : [{ description: "", hsnSac: "", quantity: 1, rate: 0 }],
  };
}
