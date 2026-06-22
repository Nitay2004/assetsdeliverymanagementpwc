"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getProducts() {
  const products = await prisma.productMaster.findMany({ orderBy: { updatedAt: "desc" } });
  return products.map(p => ({
    ...p,
    gstRate: p.gstRate ? Number(p.gstRate) : null,
  }));
}

export async function addProduct(formData: FormData) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.productMaster.create({
    data: {
      make: formData.get("make") as string,
      model: formData.get("model") as string,
      partNo: (formData.get("partNo") as string) || null,
      description: (formData.get("description") as string) || null,
      hsnCode: (formData.get("hsnCode") as string) || null,
      gstRate: formData.get("gstRate") ? Number(formData.get("gstRate")) : null,
    },
  });

  revalidatePath("/dashboard/product-master");
}

export async function updateProduct(id: string, formData: FormData) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.productMaster.update({
    where: { id },
    data: {
      make: formData.get("make") as string,
      model: formData.get("model") as string,
      partNo: (formData.get("partNo") as string) || null,
      description: (formData.get("description") as string) || null,
      hsnCode: (formData.get("hsnCode") as string) || null,
      gstRate: formData.get("gstRate") ? Number(formData.get("gstRate")) : null,
    },
  });

  revalidatePath("/dashboard/product-master");
}

export async function getProductsForDropdown() {
  return prisma.productMaster.findMany({
    select: { id: true, make: true, model: true, partNo: true },
    orderBy: [{ make: "asc" }, { model: "asc" }],
  });
}

export async function deleteProduct(id: string) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.productMaster.delete({ where: { id } });

  revalidatePath("/dashboard/product-master");
}
