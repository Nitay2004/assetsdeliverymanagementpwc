"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { syncOrderTrackingStatus } from "@/app/actions/warehouse";

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
  const now = new Date();
  const year = now.getFullYear();
  const shortYear = year % 100;
  const nextShortYear = (year + 1) % 100;
  const fy = `${String(shortYear).padStart(2, "0")}-${String(nextShortYear).padStart(2, "0")}`;

  const lastDc = await prisma.deliveryChallan.findFirst({
    where: { dcNumber: { startsWith: "DC-PDH-" } },
    orderBy: { dcNumber: "desc" },
  });

  let nextSeq = 1;
  if (lastDc) {
    const parts = lastDc.dcNumber.split("-");
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `DC-PDH-${String(nextSeq).padStart(4, "0")}-${fy}`;
}

export async function getWarehouses() {
  return prisma.warehouse.findMany({ orderBy: { name: "asc" } });
}

export async function createWarehouse(name: string, location?: string) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "FINANCE")) {
    throw new Error("Unauthorized");
  }
  return prisma.warehouse.create({ data: { name, location } });
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
  if (!user || (user.role !== "ADMIN" && user.role !== "FINANCE")) {
    throw new Error("Unauthorized");
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  const isRto = order.status === "RTO_DC_REQUESTED";
  const targetStatus = isRto ? "RTO_DC_GENERATED" : "DC_GENERATED";
  const trackingStatus = isRto ? "RTO_DC_GENERATED" : "DC_GENERATED";

  const dcNumber = await getNextDcNumber();
  const dcDate = new Date();

  const items = data.items.map((item) => {
    const amount = item.quantity * item.rate;
    const taxableValue = amount;
    return { ...item, amount, taxableValue };
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
      modeOfPayment: data.modeOfPayment,
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

  revalidatePath("/dashboard/finance");

  return { ...dc, taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null, igst: dc.igst ? Number(dc.igst) : null, totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null, items: dc.items.map(i => ({ ...i, rate: Number(i.rate), amount: Number(i.amount), taxableValue: i.taxableValue ? Number(i.taxableValue) : null, igstRate: i.igstRate ? Number(i.igstRate) : null, igstAmount: i.igstAmount ? Number(i.igstAmount) : null })) };
}

export async function getDC(dcId: string) {
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

export async function getReversePickupForDc(rpId: string) {
  const rp = await prisma.reversePickupRequest.findUnique({
    where: { id: rpId },
  });
  if (!rp) return null;

  const fullAddress = [rp.pickupAddress, rp.city, rp.state, rp.pinCode].filter(Boolean).join(", ");

  return {
    id: rp.id,
    clientName: rp.employeeName,
    totalQuantity: 1,
    deliveryLocation: fullAddress || rp.pickupAddress,
    fullAddress: fullAddress || rp.pickupAddress,
    warehouseLocation: rp.warehouseLocation || "",
    docketNumber: "",
    items: [{ description: rp.model || "Laptop", hsnSac: "", quantity: 1, rate: 0 }],
  };
}

export async function generateReversePickupDc(rpId: string, data: DcFormData) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "FINANCE")) {
    throw new Error("Unauthorized");
  }

  const rp = await prisma.reversePickupRequest.findUnique({ where: { id: rpId } });
  if (!rp) throw new Error("Reverse pickup request not found");

  const dcNumber = await getNextDcNumber();
  const dcDate = new Date();

  const items = data.items.map((item) => {
    const amount = item.quantity * item.rate;
    const taxableValue = amount;
    return { ...item, amount, taxableValue };
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
      modeOfPayment: data.modeOfPayment,
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

  await prisma.reversePickupRequest.update({
    where: { id: rpId },
    data: { dcNo: dcNumber, status: "DC_GENERATED" },
  });

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/reverse-pickup");

  return { ...dc, taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null, igst: dc.igst ? Number(dc.igst) : null, totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null, items: dc.items.map(i => ({ ...i, rate: Number(i.rate), amount: Number(i.amount), taxableValue: i.taxableValue ? Number(i.taxableValue) : null, igstRate: i.igstRate ? Number(i.igstRate) : null, igstAmount: i.igstAmount ? Number(i.igstAmount) : null })) };
}

// ─── Dispatched Through Dropdown ───

export async function getDispatchedThroughOptions() {
  const options = await prisma.dropdownOption.findMany({
    where: { category: "dispatchedThrough" },
    orderBy: { value: "asc" },
  });
  return options.map(o => ({ id: o.id, value: o.value }));
}

export async function addDispatchedThroughOption(value: string) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");
  await prisma.dropdownOption.upsert({
    where: { category_value: { category: "dispatchedThrough", value } },
    update: {},
    create: { category: "dispatchedThrough", value },
  });
}

export async function deleteDispatchedThroughOption(id: string) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");
  await prisma.dropdownOption.delete({ where: { id } });
}

// ─── Bill To Location Dropdown ───

export async function getBillToLocationOptions() {
  const options = await prisma.dropdownOption.findMany({
    where: { category: "billToLocation" },
    orderBy: { value: "asc" },
  });
  return options.map(o => ({ id: o.id, value: o.value }));
}

export async function addBillToLocationOption(value: string) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");
  await prisma.dropdownOption.upsert({
    where: { category_value: { category: "billToLocation", value } },
    update: {},
    create: { category: "billToLocation", value },
  });
}

export async function deleteBillToLocationOption(id: string) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");
  await prisma.dropdownOption.delete({ where: { id } });
}

export async function getOrderForDc(orderId: string) {
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

  const productItems = order.assets
    .filter(a => a.inventoryItem)
    .map(a => ({
      description: a.inventoryItem!.model || "",
      hsnSac: "",
      quantity: 1,
      rate: 0,
    }));

  const warehouse = order.warehouseLocation || "";

  // Build full user address from inventory item
  const inv = order.assets.find(a => a.inventoryItem)?.inventoryItem;
  const fullAddress = inv
    ? [inv.shippingAddress, inv.city, inv.state, inv.pinCode].filter(Boolean).join(", ")
    : order.deliveryLocation;

  const docketNumber = order.dockets[0]?.docketNumber || "";

  return {
    id: order.id,
    clientName: order.clientName,
    totalQuantity: order.totalQuantity,
    deliveryLocation: order.deliveryLocation,
    fullAddress,
    warehouseLocation: warehouse,
    docketNumber,
    items: productItems.length > 0 ? productItems : [{ description: "", hsnSac: "", quantity: 1, rate: 0 }],
  };
}
