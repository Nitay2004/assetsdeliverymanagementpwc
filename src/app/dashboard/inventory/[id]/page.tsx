import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EditInventoryForm } from "./edit-form";

function safeISO(date: Date | null | undefined): string | null {
  if (!date) return null;
  const t = date.getTime();
  return isNaN(t) ? null : date.toISOString();
}

export default async function EditInventoryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) notFound();

  return <EditInventoryForm item={{
    ...item,
    requestDate: safeISO(item.requestDate),
    slaStartDate: safeISO(item.slaStartDate),
    actualDeliveryDate: safeISO(item.actualDeliveryDate),
    laptopAcceptanceDate: safeISO(item.laptopAcceptanceDate),
    warrantyEndPeriod: safeISO(item.warrantyEndPeriod),
    deliveryDate: safeISO(item.deliveryDate),
    pickupDate: safeISO(item.pickupDate),
    dateOfWs1Update: safeISO(item.dateOfWs1Update),
    servicesStartDate: safeISO(item.servicesStartDate),
    date: safeISO(item.date),
    inwardDate1: safeISO(item.inwardDate1),
    outwardDate1: safeISO(item.outwardDate1),
  }} />;
}
