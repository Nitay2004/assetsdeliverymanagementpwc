"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { syncOrderTrackingStatus } from "@/app/actions/warehouse";

async function syncInventoryWarehouseLocation(orderId: string, warehouseLocation: string) {
  if (!warehouseLocation) return;
  const assetItems = await prisma.asset.findMany({
    where: { orderId, inventoryItemId: { not: null } },
    select: { inventoryItemId: true },
  });
  const itemIds = assetItems.map(a => a.inventoryItemId).filter(Boolean) as string[];
  if (itemIds.length > 0) {
    await prisma.inventoryItem.updateMany({
      where: { id: { in: itemIds } },
      data: { invoicingWarehouse: warehouseLocation },
    });
  }
}

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
  revalidatePath("/dashboard");
}

export async function advanceOrderToProvisioning(
  orderId: string,
  data: { warehouseLocation: string; provisioningLocation: string; engineerName: string }
) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "PROVISIONING" && user.role !== "WAREHOUSE")) {
    throw new Error("Unauthorized");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { assets: true },
  });
  if (!order) throw new Error("Order not found.");
  if (order.status !== "ORDER_PLACED") throw new Error("Order has already been advanced to provisioning.");

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

  await syncInventoryWarehouseLocation(orderId, data.warehouseLocation);
  await syncOrderTrackingStatus(orderId, "IN_PROVISIONING");

  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
}

export async function getOrderInventoryLocations(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      assets: {
        include: {
          inventoryItem: {
            select: { invoicingWarehouse: true },
          },
        },
      },
    },
  });
  if (!order) return { warehouseLocation: "", provisioningLocation: "" };

  const warehouseLocs = order.assets
    .map(a => a.inventoryItem?.invoicingWarehouse)
    .filter(Boolean) as string[];
  const uniqueWarehouse = [...new Set(warehouseLocs)];

  return {
    warehouseLocation: uniqueWarehouse.length === 1 ? uniqueWarehouse[0] : (warehouseLocs[0] ?? ""),
    provisioningLocation: "",
  };
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

  await syncInventoryWarehouseLocation(orderId, data.warehouseLocation);
  revalidatePath("/dashboard/provisioning");
}

export async function bulkMarkOsInstalled(assetIds: string[]) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "PROVISIONING")) {
    throw new Error("Unauthorized");
  }

  await prisma.asset.updateMany({
    where: { id: { in: assetIds }, status: "allocated" },
    data: { status: "os_installed" },
  });

  revalidatePath("/dashboard/provisioning");
}

export async function bulkAdvanceOrdersToProvisioning(
  orderIds: string[],
  data: { warehouseLocation: string; provisioningLocation: string; engineerName: string }
) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "PROVISIONING" && user.role !== "WAREHOUSE")) {
    throw new Error("Unauthorized");
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { assets: true },
  });

  for (const order of orders) {
    if (order.status !== "ORDER_PLACED") continue;

    const allAllocated = order.assets.every(a => a.inventoryItemId !== null);
    if (!allAllocated) continue;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "IN_PROVISIONING",
        warehouseLocation: data.warehouseLocation || null,
        provisioningLocation: data.provisioningLocation || null,
        engineerName: data.engineerName || null,
      },
    });

    await syncInventoryWarehouseLocation(order.id, data.warehouseLocation);
    await syncOrderTrackingStatus(order.id, "IN_PROVISIONING");
  }

  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
}

export async function handoverToLogistics(orderIds: string[]) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "PROVISIONING")) {
    throw new Error("Unauthorized");
  }

  // Advance order status to DOCKET_REQUESTED so it moves to logistics
  await prisma.order.updateMany({
    where: { id: { in: orderIds }, status: "IN_PROVISIONING" },
    data: { status: "DOCKET_REQUESTED" },
  });

  // Update tracking status on inventory items to "Handed Over to Logistics"
  const assets = await prisma.asset.findMany({
    where: { orderId: { in: orderIds }, inventoryItemId: { not: null } },
    select: { inventoryItemId: true },
  });

  const itemIds = assets.map(a => a.inventoryItemId).filter(Boolean) as string[];
  if (itemIds.length > 0) {
    await prisma.inventoryItem.updateMany({
      where: { id: { in: itemIds } },
      data: { trackingStatus: "Handed Over to Logistics" },
    });
  }

  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
}
