"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function getNextGrnNumber(): Promise<string> {
  const last = await prisma.vendorMaster.findFirst({
    where: { grnNumber: { startsWith: "GRN-" } },
    orderBy: { grnNumber: "desc" },
  });

  let nextSeq = 1;
  if (last) {
    const parts = last.grnNumber.split("-");
    const lastSeq = parseInt(parts[1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `GRN-${String(nextSeq).padStart(4, "0")}`;
}

export async function getVendors() {
  const vendors = await prisma.vendorMaster.findMany({ orderBy: { updatedAt: "desc" } });
  return vendors;
}

export async function addVendor(formData: FormData) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

  const grnNumber = await getNextGrnNumber();

  await prisma.vendorMaster.create({
    data: {
      grnNumber,
      name: formData.get("name") as string,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      address: (formData.get("address") as string) || null,
      contactPerson: (formData.get("contactPerson") as string) || null,
      gstNumber: (formData.get("gstNumber") as string) || null,
    },
  });

  revalidatePath("/dashboard/vendor-master");

  return { grnNumber };
}

export async function updateVendor(id: string, formData: FormData) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.vendorMaster.update({
    where: { id },
    data: {
      name: formData.get("name") as string,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      address: (formData.get("address") as string) || null,
      contactPerson: (formData.get("contactPerson") as string) || null,
      gstNumber: (formData.get("gstNumber") as string) || null,
    },
  });

  revalidatePath("/dashboard/vendor-master");
}

export async function deleteVendor(id: string) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.vendorMaster.delete({ where: { id } });

  revalidatePath("/dashboard/vendor-master");
}
