import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReversePickupForm } from "@/components/reverse-pickup/reverse-pickup-form";

export default async function AddReversePickupPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "REVERSE_PICKUP")) {
    redirect("/dashboard/reverse-pickup");
  }

  const sp = await props.searchParams;
  const initialData: Record<string, string> = {};
  const fieldKeys = [
    "serialNumber", "model", "entity", "imageType", "employeeName",
    "emailId", "mobileNumber", "shippingAddress", "landMark", "city",
    "state", "pinCode", "employeeId",
  ];
  for (const key of fieldKeys) {
    const val = sp[key];
    if (typeof val === "string" && val) initialData[key] = val;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">New Reverse Pickup Request</h1>
        <p className="text-muted-foreground mt-2">
          Create a request to pick up an asset from an employee.
          {initialData.serialNumber && (
            <span className="ml-1 text-primary font-medium">
              Pre-filled from serial: {initialData.serialNumber}
            </span>
          )}
        </p>
      </div>

      <ReversePickupForm initialData={initialData} />
    </div>
  );
}
