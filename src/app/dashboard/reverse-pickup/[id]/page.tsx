import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { ReversePickupDetail } from "@/components/reverse-pickup/reverse-pickup-detail";

export default async function ReversePickupDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getSession();
  if (!user) redirect("/api/auth/clear-session");

  const request = await prisma.reversePickupRequest.findUnique({ where: { id } });
  if (!request) notFound();

  const dc = request.dcNo
    ? await prisma.deliveryChallan.findFirst({ where: { reversePickupRequestId: id }, orderBy: { createdAt: "desc" }, select: { id: true } })
    : null;

  return (
    <ReversePickupDetail
      dcId={dc?.id ?? null}
      request={{
        ...request,
        specs: null,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        requestDateHp: request.requestDateHp?.toISOString() ?? null,
        lastWorkingDay: request.lastWorkingDay?.toISOString() ?? null,
        eta: request.eta?.toISOString() ?? null,
        futureDatePickup: request.futureDatePickup?.toISOString() ?? null,
        slaStartDate: request.slaStartDate?.toISOString() ?? null,
        expectedPickupDate: request.expectedPickupDate?.toISOString() ?? null,
        actualDeliveryPodDate: request.actualDeliveryPodDate?.toISOString() ?? null,
        laptopAcceptanceDate: request.laptopAcceptanceDate?.toISOString() ?? null,
        etaForUnitReceived: request.etaForUnitReceived?.toISOString() ?? null,
        pickupDate: request.pickupDate?.toISOString() ?? null,
        inspectionDate: request.inspectionDate?.toISOString() ?? null,
        receivedDate: request.receivedDate?.toISOString() ?? null,
        qcDate: request.qcDate?.toISOString() ?? null,
        qcCleanDate: request.qcCleanDate?.toISOString() ?? null,
        qcPurgeDate: request.qcPurgeDate?.toISOString() ?? null,
        blanccoDate: request.blanccoDate?.toISOString() ?? null,
        blancoClearDate: request.blancoClearDate?.toISOString() ?? null,
        blancoPurgeDate: request.blancoPurgeDate?.toISOString() ?? null,
        blancoCertificateDate: request.blancoCertificateDate?.toISOString() ?? null,
      }}
      userRole={user.role}
    />
  );
}
