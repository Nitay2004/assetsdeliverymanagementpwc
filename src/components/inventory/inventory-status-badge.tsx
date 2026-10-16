import { inventoryStatusLabel, inventoryStatusStyle } from "@/lib/inventory-status";

export function InventoryStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${inventoryStatusStyle(status)}`}
    >
      {inventoryStatusLabel(status)}
    </span>
  );
}
