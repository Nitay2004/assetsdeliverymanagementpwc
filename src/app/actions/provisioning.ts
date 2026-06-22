"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { syncOrderTrackingStatus } from "@/app/actions/warehouse";

export async function updateAssetStatus(assetId: string, status: string) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "PROVISIONING")) {
    throw new Error("Unauthorized");
  }

  await prisma.asset.update({
    where: { id: assetId },
    data: { status },
  });

  revalidatePath("/dashboard/provisioning");
}

export async function advanceOrderToProvisioning(
  orderId: string,
  data: { warehouseLocation: string; provisioningLocation: string; engineerName: string }
) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "PROVISIONING")) {
    throw new Error("Unauthorized");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { assets: true },
  });
  if (!order) throw new Error("Order not found.");

  const allAllocated = order.assets.every(a => a.inventoryItemId !== null);
  if (!allAllocated) throw new Error("Not all assets are allocated yet.");

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "IN_PROVISIONING",
      warehouseLocation: data.warehouseLocation || null,
      provisioningLocation: data.provisioningLocation || null,
      engineerName: data.engineerName || null,
    },
  });

  await syncOrderTrackingStatus(orderId, "IN_PROVISIONING");

  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard/warehouse");
}

export async function getProvisioningDropdowns() {
  const options = await prisma.dropdownOption.findMany({
    where: {
      category: { in: ["warehouseLocation", "provisioningLocation", "engineerName"] },
    },
    orderBy: { value: "asc" },
  });

  return {
    warehouseLocations: options.filter(o => o.category === "warehouseLocation").map(o => o.value),
    provisioningLocations: options.filter(o => o.category === "provisioningLocation").map(o => o.value),
    engineerNames: options.filter(o => o.category === "engineerName").map(o => o.value),
    allOptions: options.map(o => ({ id: o.id, category: o.category, value: o.value })),
  };
}

export async function addProvisioningDropdownOption(category: string, value: string) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.dropdownOption.upsert({
    where: { category_value: { category, value } },
    update: {},
    create: { category, value },
  });

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/provisioning");
}

export async function deleteProvisioningDropdownOption(id: string) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.dropdownOption.delete({ where: { id } });

  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/provisioning");
}

export async function updateOrderProvisioningDetails(
  orderId: string,
  data: { warehouseLocation: string; provisioningLocation: string; engineerName: string }
) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "PROVISIONING")) {
    throw new Error("Unauthorized");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      warehouseLocation: data.warehouseLocation || null,
      provisioningLocation: data.provisioningLocation || null,
      engineerName: data.engineerName || null,
    },
  });

  revalidatePath("/dashboard/provisioning");
}

export async function removeFromProvisioning(orderId: string) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) throw new Error("Order not found.");

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "ALLOCATED",
      warehouseLocation: null,
      provisioningLocation: null,
      engineerName: null,
    },
  });

  await syncOrderTrackingStatus(orderId, "ALLOCATED");

  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard/warehouse");
}
