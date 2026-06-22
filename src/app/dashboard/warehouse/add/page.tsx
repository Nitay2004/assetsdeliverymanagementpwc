import { OrderForm } from "@/components/orders/order-form";

export default function AddOrderPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Add Order</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create a new purchase order with asset allocation slots.
        </p>
      </div>
      <div className="rounded-xl glass p-6">
        <OrderForm />
      </div>
    </div>
  );
}
