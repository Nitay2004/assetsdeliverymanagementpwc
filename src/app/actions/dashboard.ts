"use server";

import { prisma } from "@/lib/prisma";
import type { OrderStatus, ReversePickupStatus, InventoryStatus, Prisma } from "@prisma/client";

export interface TableOrderData {
  id: string;
  clientName: string;
  deliveryLocation: string;
  totalQuantity: number;
  status: string;
  dcNumber: string | null;
  assets: { id: string; inventoryItem: { serialNumber: string } | null }[];
  dockets: { docketNumber: string | null }[];
}

export async function getOrdersByStatus(
  statuses: OrderStatus[],
  page: number = 1,
  limit: number = 50
): Promise<{ orders: TableOrderData[]; total: number }> {
  const skip = (page - 1) * limit;

  const [rawOrders, total] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: statuses } },
      include: {
        assets: { include: { inventoryItem: true } },
        dockets: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({
      where: { status: { in: statuses } },
    }),
  ]);

  const orders = rawOrders.map(o => ({
    id: o.id,
    clientName: o.clientName,
    deliveryLocation: o.deliveryLocation,
    totalQuantity: o.totalQuantity,
    status: o.status,
    dcNumber: o.dcNumber,
    assets: o.assets.map(a => ({
      id: a.id,
      inventoryItem: a.inventoryItem ? { serialNumber: a.inventoryItem.serialNumber } : null,
    })),
    dockets: o.dockets.map(d => ({ docketNumber: d.docketNumber })),
  }));

  return { orders, total };
}

export interface TableReverseData {
  id: string;
  requestNumber: string;
  employeeName: string;
  serialNumber: string;
  model: string;
  status: string;
  sla: string | null;
  caseId: string | null;
  remark: string | null;
}

export async function getReversePickupsByStatus(
  statuses: ReversePickupStatus[],
  page: number = 1,
  limit: number = 50
): Promise<{ items: TableReverseData[]; total: number }> {
  const skip = (page - 1) * limit;

  const [raw, total] = await Promise.all([
    prisma.reversePickupRequest.findMany({
      where: { status: { in: statuses } },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.reversePickupRequest.count({
      where: { status: { in: statuses } },
    }),
  ]);

  const items = raw.map(r => ({
    id: r.id,
    requestNumber: r.requestNumber,
    employeeName: r.employeeName,
    serialNumber: r.serialNumber,
    model: r.model,
    status: r.status,
    sla: r.sla,
    caseId: r.caseId,
    remark: r.remark,
  }));

  return { items, total };
}

export async function getCancelledReversePickups(
  page: number = 1,
  limit: number = 50
): Promise<{ items: TableReverseData[]; total: number }> {
  const skip = (page - 1) * limit;

  const [raw, total] = await Promise.all([
    prisma.reversePickupRequest.findMany({
      where: { remark: { contains: "cancel", mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.reversePickupRequest.count({
      where: { remark: { contains: "cancel", mode: "insensitive" } },
    }),
  ]);

  const items = raw.map(r => ({
    id: r.id,
    requestNumber: r.requestNumber,
    employeeName: r.employeeName,
    serialNumber: r.serialNumber,
    model: r.model,
    status: r.status,
    sla: r.sla,
    caseId: r.caseId,
    remark: r.remark,
  }));

  return { items, total };
}

export interface TableInventoryData {
  id: string;
  serialNumber: string;
  model: string;
  employeeName: string | null;
  status: string;
  slaStatus: string | null;
}

export async function getInventoryBySlaStatus(
  slaValue: string,
  page: number = 1,
  limit: number = 50
): Promise<{ items: TableInventoryData[]; total: number }> {
  const skip = (page - 1) * limit;

  const [raw, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { slaStatus: { equals: slaValue, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.inventoryItem.count({
      where: { slaStatus: { equals: slaValue, mode: "insensitive" } },
    }),
  ]);

  const items = raw.map(i => ({
    id: i.id,
    serialNumber: i.serialNumber,
    model: i.model,
    employeeName: i.employeeName,
    status: i.status,
    slaStatus: i.slaStatus,
  }));

  return { items, total };
}

export interface TableInventoryStatusData {
  id: string;
  serialNumber: string;
  model: string;
  employeeName: string | null;
  status: string;
  invoicingWarehouse: string | null;
  createdAt: string | null;
}

export async function getInventoryByStatus(
  status: string,
  page: number = 1,
  limit: number = 50
): Promise<{ items: TableInventoryStatusData[]; total: number }> {
  const skip = (page - 1) * limit;
  const statusFilter: InventoryStatus = status as InventoryStatus;

  const [raw, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { status: { equals: statusFilter } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.inventoryItem.count({
      where: { status: { equals: statusFilter } },
    }),
  ]);

  const items = raw.map(i => ({
    id: i.id,
    serialNumber: i.serialNumber,
    model: i.model,
    employeeName: i.employeeName,
    status: i.status,
    invoicingWarehouse: i.invoicingWarehouse,
    createdAt: i.createdAt ? i.createdAt.toISOString() : null,
  }));

  return { items, total };
}

export interface TableInventoryDeliveryData {
  id: string;
  serialNumber: string;
  model: string;
  employeeName: string | null;
  trackingStatus: string | null;
  trackingSubStatus: string | null;
  city: string | null;
  state: string | null;
  dcNumber: string | null;
}

export async function getInventoryItemsByTrackingKeywords(
  keywords: string[],
  page: number = 1,
  limit: number = 50
): Promise<{ items: TableInventoryDeliveryData[]; total: number }> {
  const skip = (page - 1) * limit;

  const orConditions = keywords.flatMap(keyword => [
    { trackingStatus: { contains: keyword, mode: "insensitive" as const } },
    { trackingSubStatus: { contains: keyword, mode: "insensitive" as const } },
  ]);

  const where: Prisma.InventoryItemWhereInput = {
    status: "ALLOCATED",
    OR: orConditions,
  };

  const [raw, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.inventoryItem.count({ where }),
  ]);

  const items = raw.map(i => ({
    id: i.id,
    serialNumber: i.serialNumber,
    model: i.model,
    employeeName: i.employeeName,
    trackingStatus: i.trackingStatus,
    trackingSubStatus: i.trackingSubStatus,
    city: i.city,
    state: i.state,
    dcNumber: i.dcNumber,
  }));

  return { items, total };
}
