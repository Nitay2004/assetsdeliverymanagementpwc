import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { OrderForm } from "@/components/orders/order-form";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit Order</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Update order details.
        </p>
      </div>
      <div className="rounded-xl glass p-6">
        <OrderForm
          order={{
            id: order.id,
            clientName: order.clientName,
            intermediary: order.intermediary,
            totalQuantity: order.totalQuantity,
            deliveryLocation: order.deliveryLocation,
          }}
        />
      </div>
    </div>
  );
}
