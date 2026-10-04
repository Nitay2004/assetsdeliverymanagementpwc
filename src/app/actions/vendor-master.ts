"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { nextSequenceNumber } from "@/lib/sequence-number";

async function getNextGrnNumber(): Promise<string> {
  const nextSeq = await nextSequenceNumber({
    table: "vendor_master",
    column: "grn_number",
    valuePattern: /^GRN-([0-9]+)$/,
  });

  return `GRN-${String(nextSeq).padStart(4, "0")}`;
}

export async function getVendors() {
  const user = await getSession();
  requirePermission(user, "vendor-master", "canView");
  const vendors = await prisma.vendorMaster.findMany({ orderBy: { updatedAt: "desc" } });
  return vendors;
}

export async function addVendor(formData: FormData) {
  const user = await getSession();
  requirePermission(user, "vendor-master", "canCreate");

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
  requirePermission(user, "vendor-master", "canEdit");

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
  requirePermission(user, "vendor-master", "canDelete");

  await prisma.vendorMaster.delete({ where: { id } });

  revalidatePath("/dashboard/vendor-master");
}
