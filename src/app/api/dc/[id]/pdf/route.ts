import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateDcPdf } from "@/lib/dc-pdf";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "FINANCE")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dc = await prisma.deliveryChallan.findUnique({
    where: { id },
    include: {
      items: true,
      warehouse: true,
      order: {
        include: {
          dockets: { orderBy: { createdAt: "desc" } },
          assets: { include: { inventoryItem: true } },
        },
      },
      reversePickupRequest: true,
    },
  });
  if (!dc) return NextResponse.json({ error: "DC not found" }, { status: 404 });

  const clientName = dc.order?.clientName ?? dc.reversePickupRequest?.employeeName ?? "Reverse Pickup";

  const latestDocket = dc.order?.dockets?.[0];
  const docketNumber = latestDocket?.docketNumber ?? dc.reversePickupRequest?.docketNumber ?? null;
  const courierName = latestDocket?.courierName ?? null;

  const inventoryItem = dc.order?.assets?.find(a => a.inventoryItem)?.inventoryItem ?? null;
  const rp = dc.reversePickupRequest;
  const isReversePickup = !!rp;

  const userName = rp?.employeeName ?? inventoryItem?.employeeName ?? null;
  const userContact = rp
    ? [rp.mobileNumber, rp.alternatePhoneNumber, rp.contact, rp.emailId].filter(Boolean).join(", ") || null
    : inventoryItem
      ? [inventoryItem.mobileNumber, inventoryItem.emailId].filter(Boolean).join(", ") || null
      : null;

  const pdfBuffer = await generateDcPdf(
    {
      dcNumber: dc.dcNumber,
      dcDate: dc.dcDate.toISOString(),
      documentTitle: isReversePickup ? "REVERSE PICKUP DELIVERY CHALLAN" : "DELIVERY CHALLAN",
      includeModeOfPayment: !isReversePickup,
      warehouseName: dc.warehouse?.name,
      shipToLocation: dc.shipToLocation,
      billToLocation: dc.billToLocation,
      userName,
      userContact,
      modeOfPayment: dc.modeOfPayment,
      referenceNo: dc.referenceNo,
      referenceDate: dc.referenceDate?.toISOString() ?? null,
      otherReferences: dc.otherReferences,
      buyersOrderNo: dc.buyersOrderNo,
      buyersOrderDate: dc.buyersOrderDate?.toISOString() ?? null,
      dispatchDocNo: docketNumber || dc.dispatchDocNo,
      // A reverse pickup challan travels back through the pickup partner, which
      // lives on the request; only forward orders have a docket courier. The
      // stored value wins because the modal already falls back to the partner.
      dispatchedThrough: isReversePickup ? dc.dispatchedThrough || rp?.partnerName : courierName || dc.dispatchedThrough,
      destination: dc.destination,
      termsOfDelivery: dc.termsOfDelivery,
      amountInWords: dc.amountInWords,
      taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null,
      igst: dc.igst ? Number(dc.igst) : null,
      totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
      taxAmountInWords: dc.taxAmountInWords,
      items: dc.items.map((i) => ({
        description: i.description,
        hsnSac: i.hsnSac,
        quantity: i.quantity,
        rate: Number(i.rate),
        amount: Number(i.amount),
        taxableValue: i.taxableValue ? Number(i.taxableValue) : null,
        igstRate: i.igstRate ? Number(i.igstRate) : null,
        igstAmount: i.igstAmount ? Number(i.igstAmount) : null,
      })),
    },
    clientName
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="DC-${dc.dcNumber}.pdf"`,
    },
  });
}
