import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReversePickupForm } from "@/components/reverse-pickup/reverse-pickup-form";

export default async function AddReversePickupPage() {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "REVERSE_PICKUP")) {
    redirect("/dashboard/reverse-pickup");
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">New Reverse Pickup Request</h1>
        <p className="text-muted-foreground mt-2">
          Create a request to pick up an asset from an employee.
        </p>
      </div>

      <ReversePickupForm />
    </div>
  );
}
