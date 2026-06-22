"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addDocket(formData: FormData) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "LOGISTICS")) {
    throw new Error("Unauthorized");
  }

  const orderId = formData.get("orderId") as string;
  const docketNumber = formData.get("docketNumber") as string;
  const ewayBillNumber = formData.get("ewayBillNumber") as string;
  const podDocumentUrl = formData.get("podDocumentUrl") as string;

  if (!orderId || !docketNumber) {
    throw new Error("Order and docket number are required.");
  }

  await prisma.docket.create({
    data: {
      orderId,
      docketNumber,
      ewayBillNumber: ewayBillNumber || null,
      podDocumentUrl: podDocumentUrl || null,
    },
  });

  revalidatePath("/dashboard/logistics");
}

export async function updateDocket(id: string, formData: FormData) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "LOGISTICS")) {
    throw new Error("Unauthorized");
  }

  const docketNumber = formData.get("docketNumber") as string;
  const ewayBillNumber = formData.get("ewayBillNumber") as string;
  const podDocumentUrl = formData.get("podDocumentUrl") as string;

  if (!docketNumber) throw new Error("Docket number is required.");

  await prisma.docket.update({
    where: { id },
    data: {
      docketNumber,
      ewayBillNumber: ewayBillNumber || null,
      podDocumentUrl: podDocumentUrl || null,
    },
  });

  revalidatePath("/dashboard/logistics");
}

export async function deleteDocket(id: string) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "LOGISTICS")) {
    throw new Error("Unauthorized");
  }

  await prisma.docket.delete({ where: { id } });

  revalidatePath("/dashboard/logistics");
}

export async function advanceOrderStatus(orderId: string, status: string) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "LOGISTICS")) {
    throw new Error("Unauthorized");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: status as any },
  });

  revalidatePath("/dashboard/logistics");
}
