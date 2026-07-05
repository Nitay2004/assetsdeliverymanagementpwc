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

export async function getAllPartNumbers() {
  const products = await prisma.productMaster.findMany({
    where: { partNo: { not: null } },
    select: { partNo: true, make: true, model: true },
    orderBy: { partNo: "asc" },
  });
  return products;
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
      warranty: (formData.get("warranty") as string) || null,
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
      warranty: (formData.get("warranty") as string) || null,
    },
  });

  revalidatePath("/dashboard/product-master");
}

export async function getProductByPartNo(partNo: string) {
  const product = await prisma.productMaster.findFirst({
    where: { partNo },
    select: {
      id: true,
      make: true,
      model: true,
      partNo: true,
      description: true,
      hsnCode: true,
      gstRate: true,
      warranty: true,
    },
  });
  if (!product) return null;
  return {
    ...product,
    gstRate: product.gstRate ? Number(product.gstRate) : null,
  };
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
