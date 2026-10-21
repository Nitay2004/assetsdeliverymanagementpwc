"use server";

import { prisma } from "@/lib/prisma";
import { getSession, requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { syncOrderTrackingStatus } from "@/lib/order-sync";
import { nextSequenceNumber } from "@/lib/sequence-number";
import { withUniqueRetry } from "@/lib/retry";

// GST place-of-supply depends on the state of the shipper and the consignee.
// Locations in this app are free-form strings that may carry a full state name
// ("Kolkata, West Bengal, 700001"), just a city ("Kolkata"), or a state code.
// City names are common — the warehouse defaults are 'Kolkata', 'Bangalore',
// 'Gurgaon' — so cities are mapped to their state before falling back to null.
const CITY_TO_STATE: Record<string, string> = {
  kolkata: "west bengal", howrah: "west bengal", siliguri: "west bengal", durgapur: "west bengal",
  bangalore: "karnataka", bengaluru: "karnataka", mysore: "karnataka", mangalore: "karnataka", hubli: "karnataka",
  gurgaon: "haryana", gurugram: "haryana", faridabad: "haryana", panipat: "haryana", hisar: "haryana",
  mumbai: "maharashtra", pune: "maharashtra", nagpur: "maharashtra", nashik: "maharashtra", thane: "maharashtra",
  chennai: "tamil nadu", coimbatore: "tamil nadu", madurai: "tamil nadu", trichy: "tamil nadu", salem: "tamil nadu",
  noida: "uttar pradesh", lucknow: "uttar pradesh", kanpur: "uttar pradesh", agra: "uttar pradesh", varanasi: "uttar pradesh", ghaziabad: "uttar pradesh",
  delhi: "delhi", "new delhi": "delhi",
  hyderabad: "telangana", secunderabad: "telangana", warangal: "telangana",
  ahmedabad: "gujarat", surat: "gujarat", vadodara: "gujarat", rajkot: "gujarat", gandhinagar: "gujarat",
  jaipur: "rajasthan", jodhpur: "rajasthan", udaipur: "rajasthan",
  chandigarh: "chandigarh", mohali: "punjab", ludhiana: "punjab", amritsar: "punjab", jalandhar: "punjab",
  indore: "madhya pradesh", bhopal: "madhya pradesh", jabalpur: "madhya pradesh", gwalior: "madhya pradesh",
  patna: "bihar", gaya: "bihar", muzaffarpur: "bihar",
  ranchi: "jharkhand", jamshedpur: "jharkhand", dhanbad: "jharkhand",
  bhubaneswar: "odisha", cuttack: "odisha", rourkela: "odisha",
  kochi: "kerala", cochin: "kerala", thiruvananthapuram: "kerala", kozhikode: "kerala",
  guwahati: "assam", dispur: "assam",
  raipur: "chhattisgarh", bilaspur: "chhattisgarh",
  dehradun: "uttarakhand", haridwar: "uttarakhand",
  goa: "goa", panaji: "goa",
  shimla: "himachal pradesh", solan: "himachal pradesh",
  srinagar: "jammu and kashmir", jammu: "jammu and kashmir",
  puducherry: "puducherry", pondicherry: "puducherry",
  visakhapatnam: "andhra pradesh", vijayawada: "andhra pradesh", guntur: "andhra pradesh", tirupati: "andhra pradesh",
};

function getStateFromLocation(loc: string | null | undefined): string | null {
  if (!loc) return null;
  const text = loc.toLowerCase();
  const states = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh", "uttarakhand", "west bengal",
    "delhi", "jammu and kashmir", "ladakh", "chandigarh", "puducherry", "andaman and nicobar", "daman and diu", "dadra and nagar haveli", "lakshadweep",
  ];
  for (const s of states) {
    if (text.includes(s)) return s;
  }
  // Match a standalone city token (whole word) to avoid false positives inside
  // other words.
  const tokens = text.match(/[a-z]+/g) ?? [];
  for (const token of tokens) {
    const mapped = CITY_TO_STATE[token];
    if (mapped) return mapped;
  }
  return null;
}

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
  const month = now.getMonth() + 1;
  let fyStart = year;
  if (month < 4) {
    fyStart = year - 1;
  }
  const shortYear = fyStart % 100;
  const nextShortYear = (fyStart + 1) % 100;
  const fy = `${String(shortYear).padStart(2, "0")}-${String(nextShortYear).padStart(2, "0")}`;

  const nextSeq = await nextSequenceNumber({
    table: "delivery_challans",
    column: "dc_number",
    valuePattern: new RegExp(`^DC-PDH-([0-9]+)-${String(shortYear).padStart(2,"0")}-${String(nextShortYear).padStart(2,"0")}$`),
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

  // delivery_challans.warehouse_id and rto_records.warehouse_id are
  // onDelete: SetNull, so the old P2003 catch never fired and the delete always
  // succeeded — silently detaching historical documents from their warehouse.
  // Block it outright when the warehouse is referenced.
  const [dcCount, rtoCount] = await Promise.all([
    prisma.deliveryChallan.count({ where: { warehouseId: id } }),
    prisma.rtoRecord.count({ where: { warehouseId: id } }),
  ]);
  if (dcCount > 0 || rtoCount > 0) {
    throw new Error("Cannot delete warehouse: it is linked to existing DCs or RTO records.");
  }

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

  // A DC is only generated at the two lifecycle points that call for one. This
  // stops a client from generating a DC for (and thereby advancing) an order
  // that is already dispatched, delivered, cancelled, etc.
  if (!isRto && order.status !== "IN_PROVISIONING" && order.status !== "DC_REQUESTED") {
    throw new Error("A DC can only be generated while the order is in provisioning or has requested one.");
  }

  // Guard against a second forward DC silently superseding the first one. RTO
  // DCs are a separate document on the same order, so they are exempt.
  if (!isRto) {
    const existingDc = await prisma.deliveryChallan.findFirst({
      where: { orderId },
      select: { dcNumber: true },
    });
    if (existingDc) {
      throw new Error(`A delivery challan (${existingDc.dcNumber}) already exists for this order.`);
    }
  }

  const targetStatus = isRto ? "RTO_DC_GENERATED" : "DC_GENERATED";
  const trackingStatus = isRto ? "RTO_DC_GENERATED" : "DC_GENERATED";

  const dcDate = new Date();

  // Product Master stays the source of truth for the HSN and GST rate
  const hsnByModel: Record<string, string> = {};
  const gstRateByModel: Record<string, number> = {};
  for (const a of order.assets) {
    if (!a.inventoryItem) continue;
    const modelKey = (a.inventoryItem.model || "").trim().toLowerCase();
    if (modelKey && hsnByModel[modelKey] === undefined) {
      hsnByModel[modelKey] = (await lookupProductHsn(a.inventoryItem.partNo, a.inventoryItem.model)) ?? "";
    }
    if (modelKey && gstRateByModel[modelKey] === undefined) {
      const pm = await prisma.productMaster.findFirst({
        where: a.inventoryItem.partNo
          ? { partNo: { equals: a.inventoryItem.partNo, mode: "insensitive" } }
          : { model: { equals: a.inventoryItem.model, mode: "insensitive" } },
        select: { gstRate: true },
      });
      if (pm?.gstRate != null) {
        gstRateByModel[modelKey] = Number(pm.gstRate);
      }
    }
  }

  // Determine if intra-state or inter-state
  const shipperState = getStateFromLocation(data.warehouseLocation || order.warehouseLocation);
  const consigneeState = getStateFromLocation(data.shipToLocation || order.deliveryLocation);
  const isIntraState = shipperState && consigneeState && shipperState === consigneeState;

  const items = await Promise.all(
    data.items.map(async (item) => {
      const amount = item.quantity * item.rate;
      const taxableValue = amount;
      const key = (item.description || "").trim().toLowerCase();
      const hsnSac = item.hsnSac || hsnByModel[key] || "";
      let gstRate = gstRateByModel[key];
      if (gstRate == null && hsnSac) {
        const pm = await prisma.productMaster.findFirst({
          where: { hsnCode: { equals: hsnSac, mode: "insensitive" } },
          select: { gstRate: true },
        });
        if (pm?.gstRate != null) gstRate = Number(pm.gstRate);
      }
      if (gstRate == null) gstRate = 18;
      return {
        ...item,
        hsnSac,
        amount,
        taxableValue,
        gstRate,
      };
    })
  );

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const totalTaxableValue = items.reduce((sum, i) => sum + i.taxableValue, 0);

  let totalIgstAmount = 0;
  let totalCgstAmount = 0;
  let totalSgstAmount = 0;
  const computedItems = items.map((item) => {
    const gstRate = item.gstRate || 18;
    if (isIntraState) {
      const cgstRate = gstRate / 2;
      const sgstRate = gstRate / 2;
      const cgstAmount = item.taxableValue * (cgstRate / 100);
      const sgstAmount = item.taxableValue * (sgstRate / 100);
      totalCgstAmount += cgstAmount;
      totalSgstAmount += sgstAmount;
      return {
        ...item,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate: null,
        igstAmount: 0,
      };
    } else {
      const igstRate = gstRate;
      const igstAmount = item.taxableValue * (igstRate / 100);
      totalIgstAmount += igstAmount;
      return {
        ...item,
        igstRate,
        igstAmount,
        cgstRate: null,
        cgstAmount: 0,
        sgstRate: null,
        sgstAmount: 0,
      };
    }
  });

  const totalTaxAmount = isIntraState ? totalCgstAmount + totalSgstAmount : totalIgstAmount;
  const amountInWords = numberToWords(Math.round(totalAmount)) + " Only";
  const taxAmountInWords = numberToWords(Math.round(totalTaxAmount)) + " Only";

  const { dc, freshNumber: dcNumber } = await withUniqueRetry(async () => {
    const freshNumber = await getNextDcNumber();
    return prisma.$transaction(async (tx) => {
      const created = await tx.deliveryChallan.create({
        data: {
          orderId,
          dcNumber: freshNumber,
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
          igst: totalIgstAmount || null,
          cgst: totalCgstAmount || null,
          sgst: totalSgstAmount || null,
          totalTaxAmount,
          taxAmountInWords,
          items: {
            create: computedItems.map((item) => ({
              description: item.description,
              hsnSac: item.hsnSac,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              taxableValue: item.taxableValue,
              igstRate: item.igstRate,
              igstAmount: item.igstAmount || 0,
              cgstRate: item.cgstRate,
              cgstAmount: item.cgstAmount || 0,
              sgstRate: item.sgstRate,
              sgstAmount: item.sgstAmount || 0,
            })),
          },
        },
        include: { items: true },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { dcNumber: freshNumber, status: targetStatus },
      });
      return { dc: created, freshNumber };
    });
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

  return {
    ...dc,
    taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null,
    igst: dc.igst ? Number(dc.igst) : null,
    cgst: (dc as any).cgst ? Number((dc as any).cgst) : null,
    sgst: (dc as any).sgst ? Number((dc as any).sgst) : null,
    totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
    items: dc.items.map(i => ({
      ...i,
      rate: Number(i.rate),
      amount: Number(i.amount),
      taxableValue: i.taxableValue ? Number(i.taxableValue) : null,
      igstRate: (i as any).igstRate ? Number((i as any).igstRate) : null,
      igstAmount: (i as any).igstAmount ? Number((i as any).igstAmount) : null,
      cgstRate: (i as any).cgstRate ? Number((i as any).cgstRate) : null,
      cgstAmount: (i as any).cgstAmount ? Number((i as any).cgstAmount) : null,
      sgstRate: (i as any).sgstRate ? Number((i as any).sgstRate) : null,
      sgstAmount: (i as any).sgstAmount ? Number((i as any).sgstAmount) : null,
    }))
  };
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
    cgst: dc.cgst ? Number(dc.cgst) : null,
    sgst: dc.sgst ? Number(dc.sgst) : null,
    totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
    items: dc.items.map(i => ({
      ...i,
      rate: Number(i.rate),
      amount: Number(i.amount),
      taxableValue: i.taxableValue ? Number(i.taxableValue) : null,
      igstRate: i.igstRate ? Number(i.igstRate) : null,
      igstAmount: i.igstAmount ? Number(i.igstAmount) : null,
      cgstRate: i.cgstRate ? Number(i.cgstRate) : null,
      cgstAmount: i.cgstAmount ? Number(i.cgstAmount) : null,
      sgstRate: i.sgstRate ? Number(i.sgstRate) : null,
      sgstAmount: i.sgstAmount ? Number(i.sgstAmount) : null,
    })),
  };
}

export async function getDCsByOrder(orderId: string) {
  await requireAuth();
  const dcs = await prisma.deliveryChallan.findMany({
    where: { orderId },
    include: { items: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return dcs.map(dc => ({
    ...dc,
    taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null,
    igst: dc.igst ? Number(dc.igst) : null,
    cgst: dc.cgst ? Number(dc.cgst) : null,
    sgst: dc.sgst ? Number(dc.sgst) : null,
    totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
    items: dc.items.map(i => ({
      ...i,
      rate: Number(i.rate),
      amount: Number(i.amount),
      taxableValue: i.taxableValue ? Number(i.taxableValue) : null,
      igstRate: i.igstRate ? Number(i.igstRate) : null,
      igstAmount: i.igstAmount ? Number(i.igstAmount) : null,
      cgstRate: i.cgstRate ? Number(i.cgstRate) : null,
      cgstAmount: i.cgstAmount ? Number(i.cgstAmount) : null,
      sgstRate: i.sgstRate ? Number(i.sgstRate) : null,
      sgstAmount: i.sgstAmount ? Number(i.sgstAmount) : null,
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

  const dcDate = new Date();
  const resolvedHsn = await resolveProductHsn(rp.serialNumber, rp.model);

  const shipperState = getStateFromLocation(rp.warehouseLocation);
  const consigneeState = getStateFromLocation(rp.pickupAddress) || getStateFromLocation(`${rp.pickupAddress}, ${rp.city}, ${rp.state}, ${rp.pinCode}`);
  const isIntraState = shipperState && consigneeState && shipperState === consigneeState;

  const items = await Promise.all(
    data.items.map(async (item) => {
      const amount = item.quantity * item.rate;
      const taxableValue = amount;
      const key = (item.description || "").trim().toLowerCase();
      const hsnSac = item.hsnSac || resolvedHsn || "";
      let gstRate = 18;
      const pm = await prisma.productMaster.findFirst({
        where: hsnSac ? { hsnCode: { equals: hsnSac, mode: "insensitive" } } : { model: { equals: key, mode: "insensitive" } },
        select: { gstRate: true },
      });
      if (pm?.gstRate != null) gstRate = Number(pm.gstRate);
      return { ...item, hsnSac, amount, taxableValue, gstRate };
    })
  );

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const totalTaxableValue = items.reduce((sum, i) => sum + i.taxableValue, 0);

  let totalIgstAmount = 0;
  let totalCgstAmount = 0;
  let totalSgstAmount = 0;
  const computedItems = items.map((item) => {
    const gstRate = item.gstRate || 18;
    if (isIntraState) {
      const cgstRate = gstRate / 2;
      const sgstRate = gstRate / 2;
      const cgstAmount = item.taxableValue * (cgstRate / 100);
      const sgstAmount = item.taxableValue * (sgstRate / 100);
      totalCgstAmount += cgstAmount;
      totalSgstAmount += sgstAmount;
      return {
        ...item,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate: null,
        igstAmount: 0,
      };
    } else {
      const igstRate = gstRate;
      const igstAmount = item.taxableValue * (igstRate / 100);
      totalIgstAmount += igstAmount;
      return {
        ...item,
        igstRate,
        igstAmount,
        cgstRate: null,
        cgstAmount: 0,
        sgstRate: null,
        sgstAmount: 0,
      };
    }
  });

  const totalTaxAmount = isIntraState ? totalCgstAmount + totalSgstAmount : totalIgstAmount;
  const amountInWords = numberToWords(Math.round(totalAmount)) + " Only";
  const taxAmountInWords = numberToWords(Math.round(totalTaxAmount)) + " Only";

  const { dc, freshNumber: dcNumber } = await withUniqueRetry(async () => {
    const freshNumber = await getNextDcNumber();
    return prisma.$transaction(async (tx) => {
      const created = await tx.deliveryChallan.create({
        data: {
          reversePickupRequestId: rpId,
          dcNumber: freshNumber,
          dcDate,
          warehouseId: data.warehouseId || null,
          shipToLocation: data.shipToLocation,
          billToLocation: data.billToLocation,
          modeOfPayment: null,
          referenceNo: data.referenceNo,
          referenceDate: data.referenceDate ? new Date(data.referenceDate) : null,
          otherReferences: data.otherReferences,
          buyersOrderNo: data.buyersOrderNo,
          buyersOrderDate: data.buyersOrderDate ? new Date(data.buyersOrderDate) : null,
          dispatchDocNo: data.dispatchDocNo,
          dispatchedThrough: data.dispatchedThrough || rp.partnerName,
          destination: data.destination,
          termsOfDelivery: data.termsOfDelivery,
          amountInWords,
          taxableValue: totalTaxableValue,
          igst: totalIgstAmount || null,
          cgst: totalCgstAmount || null,
          sgst: totalSgstAmount || null,
          totalTaxAmount,
          taxAmountInWords,
          items: {
            create: computedItems.map((item) => ({
              description: item.description,
              hsnSac: item.hsnSac,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              taxableValue: item.taxableValue,
              igstRate: item.igstRate,
              igstAmount: item.igstAmount || 0,
              cgstRate: item.cgstRate,
              cgstAmount: item.cgstAmount || 0,
              sgstRate: item.sgstRate,
              sgstAmount: item.sgstAmount || 0,
            })),
          },
        },
        include: { items: true },
      });
      await tx.reversePickupRequest.update({
        where: { id: rpId },
        data: { dcNo: freshNumber, status: "DC_GENERATED" },
      });
      return { dc: created, freshNumber };
    });
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

  return {
    ...dc,
    taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null,
    igst: dc.igst ? Number(dc.igst) : null,
    cgst: (dc as any).cgst ? Number((dc as any).cgst) : null,
    sgst: (dc as any).sgst ? Number((dc as any).sgst) : null,
    totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
    items: dc.items.map(i => ({
      ...i,
      rate: Number(i.rate),
      amount: Number(i.amount),
      taxableValue: i.taxableValue ? Number(i.taxableValue) : null,
      igstRate: (i as any).igstRate ? Number((i as any).igstRate) : null,
      igstAmount: (i as any).igstAmount ? Number((i as any).igstAmount) : null,
      cgstRate: (i as any).cgstRate ? Number((i as any).cgstRate) : null,
      cgstAmount: (i as any).cgstAmount ? Number((i as any).cgstAmount) : null,
      sgstRate: (i as any).sgstRate ? Number((i as any).sgstRate) : null,
      sgstAmount: (i as any).sgstAmount ? Number((i as any).sgstAmount) : null,
    }))
  };
}


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
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
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
