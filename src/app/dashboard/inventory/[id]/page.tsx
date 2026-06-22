import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EditInventoryForm } from "./edit-form";

export default async function EditInventoryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) notFound();

  return <EditInventoryForm item={item} />;
}
