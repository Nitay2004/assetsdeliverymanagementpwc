"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Truck, ClipboardCheck, Warehouse, ShieldCheck, FileText, Package, Circle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  assignPartner,
  requestDocket,
  recordInspection,
  markAsPickedUp,
  receiveAtWarehouse,
  recordQc,
  requestDc,
  requestEwayBill,
  uploadBlancoCertificate,
  completeReversePickup,
  getReversePickupDropdowns,
  addReversePickupDropdownOption,
  deleteReversePickupDropdownOption,
  seedReversePickupDropdowns,
} from "@/app/actions/reverse-pickup";
import { getNextStatus } from "@/lib/reverse-pickup-config";
import { ManageableDropdown } from "@/components/inventory/manageable-dropdown";

interface RequestData {
  id: string;
  requestNumber: string;
  year: number | null;
  type: string | null;
  srNo: string | null;
  requestDateHp: string | null;
  employeeId: string | null;
  alternateId: string | null;
  lastWorkingDay: string | null;
  employeeName: string;
  emailId: string | null;
  mobileNumber: string | null;
  contact: string | null;
  serialNumber: string;
  model: string;
  specs: string | null;
  entity: string | null;
  imageType: string | null;
  accessories: string | null;
  reason: string | null;
  pickupAddress: string;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  landmark: string | null;
  warehouseLocation: string | null;
  receiverSerialNo: string | null;
  receiverSnEntity: string | null;
  displayStatus: string | null;
  eta: string | null;
  futureDatePickup: string | null;
  dependency: string | null;
  remarks: string | null;
  emailReceivedHour: string | null;
  cutOffStatus: string | null;
  slaStartDate: string | null;
  slaState: string | null;
  zone1: string | null;
  tier1: string | null;
  odaLocation: string | null;
  tat: string | null;
  deliveryTat: string | null;
  actualDeliveryPodDate: string | null;
  sla: string | null;
  laptopAcceptanceDate: string | null;
  courierName: string | null;
  docketNumber: string | null;
  pickupDate: string | null;
  dcNo: string | null;
  srnNo: string | null;
  eWayBillNo: string | null;
  etaForUnitReceived: string | null;
  caseAge: string | null;
  partnerName: string | null;
  partnerReference: string | null;
  inspectionRemarks: string | null;
  inspectionDate: string | null;
  receivedDate: string | null;
  receivedBy: string | null;
  qcRemarks: string | null;
  qcDate: string | null;
  qcPerformedBy: string | null;
  qcResult: string | null;
  blanccoYesNo: string | null;
  blanccoDate: string | null;
  blancoCertificateUrl: string | null;
  blancoCertificateDate: string | null;
  caseId: string | null;
  issueReported: string | null;
  replacementPart: string | null;
  exceptionRemarks: string | null;
  remark: string | null;
  status: string;
  finalDisposition: string | null;
  inventoryItemId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AvailableItem {
  id: string;
  serialNumber: string;
  model: string;
}

interface Props {
  request: RequestData;
  availableItems: AvailableItem[];
  userRole: string;
  dcId: string | null;
}

const STEPS = [
  { key: "REQUESTED", label: "Requested", icon: Circle },
  { key: "PARTNER_ASSIGNED", label: "Partner Assigned", icon: Truck },
  { key: "DOCKET_REQUESTED", label: "Docket Req.", icon: FileText },
  { key: "INSPECTED", label: "Inspected", icon: ClipboardCheck },
  { key: "PICKED_UP", label: "Picked Up", icon: Truck },
  { key: "RECEIVED_AT_WAREHOUSE", label: "At Warehouse", icon: Warehouse },
  { key: "QC_COMPLETED", label: "QC Completed", icon: ShieldCheck },
  { key: "DC_REQUESTED", label: "DC Req.", icon: FileText },
  { key: "DC_GENERATED", label: "DC Gen.", icon: FileText },
  { key: "EWAY_BILL_REQUESTED", label: "E-Way Req.", icon: FileText },
  { key: "EWAY_BILL_GENERATED", label: "E-Way Gen.", icon: FileText },
  { key: "BLANCO_CERTIFIED", label: "Blanco Cert", icon: FileText },
  { key: "COMPLETED", label: "Completed", icon: Package },
];

export function ReversePickupDetail({ request, availableItems, userRole, dcId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [dropdownData, setDropdownData] = useState<{
    warehouseLocation: string[];
    partnerName: string[];
    disposition: string[];
    type: string[];
    entity: string[];
    imageType: string[];
    reason: string[];
    displayStatus: string[];
    dependency: string[];
    courierName: string[];
    blanccoYesNo: string[];
    allOptions: { id: string; category: string; value: string }[];
  } | null>(null);

  const [partnerName, setPartnerName] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [finalDisposition, setFinalDisposition] = useState("");

  const loadDropdowns = useCallback(async () => {
    let data = await getReversePickupDropdowns();
    if (data.type.length === 0) {
      await seedReversePickupDropdowns();
      data = await getReversePickupDropdowns();
    }
    setDropdownData(data);
  }, []);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  async function handleAdd(cat: string, val: string) {
    await addReversePickupDropdownOption(cat, val);
    await loadDropdowns();
  }

  async function handleDelete(id: string) {
    await deleteReversePickupDropdownOption(id);
    await loadDropdowns();
  }

  const canManage = userRole === "ADMIN" || userRole === "REVERSE_PICKUP" || userRole === "WAREHOUSE" || userRole === "PROVISIONING";

  const currentStepIndex = STEPS.findIndex(s => s.key === request.status);
  const nextAction = getNextStatus(request.status);

  const handleAction = async (actionName: string, formData: FormData) => {
    setLoading(actionName);
    try {
      formData.append("id", request.id);
      const actionMap: Record<string, (fd: FormData) => Promise<void>> = {
        assignPartner,
        requestDocket,
        recordInspection,
        markAsPickedUp,
        receiveAtWarehouse,
        recordQc,
        requestDc,
        requestEwayBill,
        uploadBlancoCertificate,
        completeReversePickup,
      };
      await actionMap[actionName](formData);
      toast({ title: "Action completed successfully", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({ title: "Action failed", description: String(err), variant: "error" });
    } finally {
      setLoading(null);
    }
  };

  const STATUS_STYLES: Record<string, { label: string; color: string }> = {
    REQUESTED:              { label: "Requested",              color: "bg-yellow-100 text-yellow-700" },
    PARTNER_ASSIGNED:       { label: "Partner Assigned",       color: "bg-blue-100 text-blue-700" },
    DOCKET_REQUESTED:       { label: "Docket Requested",       color: "bg-orange-100 text-orange-700" },
    INSPECTED:              { label: "Inspected",              color: "bg-indigo-100 text-indigo-700" },
    PICKED_UP:              { label: "Picked Up",              color: "bg-purple-100 text-purple-700" },
    RECEIVED_AT_WAREHOUSE:  { label: "At Warehouse",           color: "bg-cyan-100 text-cyan-700" },
    QC_COMPLETED:           { label: "QC Completed",           color: "bg-green-100 text-green-700" },
    DC_REQUESTED:           { label: "DC Requested",           color: "bg-orange-100 text-orange-700" },
    DC_GENERATED:           { label: "DC Generated",           color: "bg-indigo-100 text-indigo-700" },
    EWAY_BILL_REQUESTED:    { label: "E-Way Bill Requested",   color: "bg-yellow-100 text-yellow-700" },
    EWAY_BILL_GENERATED:    { label: "E-Way Bill Generated",   color: "bg-indigo-100 text-indigo-700" },
    BLANCO_CERTIFIED:       { label: "Blanco Certified",       color: "bg-teal-100 text-teal-700" },
    COMPLETED:              { label: "Completed",              color: "bg-emerald-100 text-emerald-700" },
  };

  const currentStyle = STATUS_STYLES[request.status] ?? { label: request.status, color: "bg-gray-100 text-gray-600" };

  const isPending = (name: string) => loading === name;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/reverse-pickup"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="size-4" />
            Back to List
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {request.requestNumber}
          </h1>
          <p className="text-muted-foreground mt-1">
            {request.employeeName} &middot; {request.serialNumber} &middot; {request.model}
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${currentStyle.color}`}>
          {currentStyle.label}
        </span>
      </div>

      {/* Progress Tracker */}
      <div className="rounded-xl glass shadow-sm p-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const isFuture = idx > currentStepIndex;

            return (
              <div key={step.key} className="flex flex-col items-center gap-2 flex-1 relative">
                {idx > 0 && (
                  <div className={`absolute top-4 -left-1/2 w-full h-0.5 ${
                    isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                  }`} />
                )}
                <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary text-primary"
                    : "border-muted-foreground/30 text-muted-foreground/50"
                }`}>
                  {isCompleted ? <Check className="size-4" /> : <StepIcon className="size-4" />}
                </div>
                <span className={`text-[10px] font-semibold text-center leading-tight ${
                  isCompleted || isCurrent ? "text-primary" : "text-muted-foreground/50"
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl glass shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Employee Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{request.employeeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{request.emailId || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mobile</span>
              <span>{request.mobileNumber || "—"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl glass shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Asset Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Serial No.</span>
              <span className="font-mono font-medium">{request.serialNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Model</span>
              <span>{request.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Specs</span>
              <span>{request.specs || "—"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl glass shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pickup Address</h3>
          <p className="text-sm">{request.pickupAddress}</p>
          {request.city && (
            <p className="text-sm text-muted-foreground">
              {request.city}{request.state ? `, ${request.state}` : ""}{request.pinCode ? ` - ${request.pinCode}` : ""}
            </p>
          )}
          {request.landmark && <p className="text-sm text-muted-foreground">Landmark: {request.landmark}</p>}
        </div>

        {request.warehouseLocation && (
          <div className="rounded-xl glass shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Warehouse Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">{request.warehouseLocation}</span>
              </div>
              {request.receivedDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Received On</span>
                  <span>{new Date(request.receivedDate).toLocaleDateString("en-GB")}</span>
                </div>
              )}
              {request.receivedBy && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Received By</span>
                  <span>{request.receivedBy}</span>
                </div>
              )}
              {request.qcResult && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">QC Result</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    request.qcResult === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>{request.qcResult}</span>
                </div>
              )}
              {request.finalDisposition && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disposition</span>
                  <span className="font-medium">{request.finalDisposition}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Extra Info Cards - only show if data exists */}
      {(request.type || request.entity || request.reason || request.displayStatus || request.dependency || request.courierName) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {request.type && (
            <div className="rounded-xl glass shadow-sm p-5 space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Request Info</h3>
              <div className="space-y-1.5 text-sm">
                {request.year && <div className="flex justify-between"><span className="text-muted-foreground">Year</span><span>{request.year}</span></div>}
                {request.type && <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{request.type}</span></div>}
                {request.srNo && <div className="flex justify-between"><span className="text-muted-foreground">Sr #</span><span>{request.srNo}</span></div>}
                {request.requestDateHp && <div className="flex justify-between"><span className="text-muted-foreground">Request Date</span><span>{new Date(request.requestDateHp).toLocaleDateString("en-GB")}</span></div>}
                {request.employeeId && <div className="flex justify-between"><span className="text-muted-foreground">Employee ID</span><span>{request.employeeId}</span></div>}
                {request.alternateId && <div className="flex justify-between"><span className="text-muted-foreground">Alt ID</span><span>{request.alternateId}</span></div>}
                {request.lastWorkingDay && <div className="flex justify-between"><span className="text-muted-foreground">Last Working Day</span><span>{new Date(request.lastWorkingDay).toLocaleDateString("en-GB")}</span></div>}
                {request.entity && <div className="flex justify-between"><span className="text-muted-foreground">Entity</span><span>{request.entity}</span></div>}
                {request.imageType && <div className="flex justify-between"><span className="text-muted-foreground">Image Type</span><span>{request.imageType}</span></div>}
                {request.reason && <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><span>{request.reason}</span></div>}
              </div>
            </div>
          )}
          {(request.displayStatus || request.dependency || request.courierName || request.docketNumber || request.dcNo) && (
            <div className="rounded-xl glass shadow-sm p-5 space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Logistics</h3>
              <div className="space-y-1.5 text-sm">
                {request.displayStatus && <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{request.displayStatus}</span></div>}
                {request.eta && <div className="flex justify-between"><span className="text-muted-foreground">ETA</span><span>{new Date(request.eta).toLocaleDateString("en-GB")}</span></div>}
                {request.futureDatePickup && <div className="flex justify-between"><span className="text-muted-foreground">Future Pickup</span><span>{new Date(request.futureDatePickup).toLocaleDateString("en-GB")}</span></div>}
                {request.dependency && <div className="flex justify-between"><span className="text-muted-foreground">Dependency</span><span>{request.dependency}</span></div>}
                {request.courierName && <div className="flex justify-between"><span className="text-muted-foreground">Courier</span><span>{request.courierName}</span></div>}
                {request.docketNumber && <div className="flex justify-between"><span className="text-muted-foreground">Docket</span><span>{request.docketNumber}</span></div>}
                {request.pickupDate && <div className="flex justify-between"><span className="text-muted-foreground">Pickup Date</span><span>{new Date(request.pickupDate).toLocaleDateString("en-GB")}</span></div>}
                {request.dcNo && <div className="flex justify-between"><span className="text-muted-foreground">DC No</span><span>{request.dcNo}</span></div>}
                {dcId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DC PDF</span>
                    <a href={`/api/dc/${dcId}/pdf`} target="_blank" className="text-primary font-semibold hover:underline text-sm">View DC</a>
                  </div>
                )}
                {request.srnNo && <div className="flex justify-between"><span className="text-muted-foreground">SRN</span><span>{request.srnNo}</span></div>}
                {request.eWayBillNo && <div className="flex justify-between"><span className="text-muted-foreground">E-Way Bill</span><span>{request.eWayBillNo}</span></div>}
                {request.etaForUnitReceived && <div className="flex justify-between"><span className="text-muted-foreground">ETA Received</span><span>{new Date(request.etaForUnitReceived).toLocaleDateString("en-GB")}</span></div>}
              </div>
            </div>
          )}
          {(request.caseId || request.blanccoYesNo || request.issueReported) && (
            <div className="rounded-xl glass shadow-sm p-5 space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Case &amp; Blancco</h3>
              <div className="space-y-1.5 text-sm">
                {request.caseId && <div className="flex justify-between"><span className="text-muted-foreground">Case ID</span><span>{request.caseId}</span></div>}
                {request.issueReported && <div className="flex justify-between"><span className="text-muted-foreground">Issue</span><span className="text-right max-w-[180px] truncate">{request.issueReported}</span></div>}
                {request.replacementPart && <div className="flex justify-between"><span className="text-muted-foreground">Replacement</span><span>{request.replacementPart}</span></div>}
                {request.blanccoYesNo && <div className="flex justify-between"><span className="text-muted-foreground">Blancco</span><span>{request.blanccoYesNo}</span></div>}
                {request.blanccoDate && <div className="flex justify-between"><span className="text-muted-foreground">Blancco Date</span><span>{new Date(request.blanccoDate).toLocaleDateString("en-GB")}</span></div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Forms */}
      {canManage && (
        <>
          {nextAction && (
            <div className="rounded-xl glass shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                Next Step: {nextAction.label}
              </h2>

              {/* Assign Partner */}
              {request.status === "REQUESTED" && (
                <form action={async (formData) => handleAction("assignPartner", formData)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">
                        Partner Name <span className="text-red-500">*</span>
                      </label>
                      <ManageableDropdown
                        name="partnerName"
                        placeholder="Select partner..."
                        value={partnerName}
                        onChange={setPartnerName}
                        options={dropdownData?.partnerName ?? []}
                        allOptions={dropdownData?.allOptions ?? []}
                        category="partnerName"
                        onAdd={handleAdd}
                        onDelete={handleDelete}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="partnerReference" className="text-sm font-medium text-foreground">Reference No.</label>
                      <input
                        id="partnerReference"
                        name="partnerReference"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="AWB / Ref number"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isPending("assignPartner")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("assignPartner") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("assignPartner") ? "Assigning..." : "Assign Partner"}
                  </button>
                </form>
              )}

              {/* Request Docket from Logistics */}
              {request.status === "PARTNER_ASSIGNED" && (
                <form action={async (formData) => handleAction("requestDocket", formData)} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Request a reverse docket number from the Logistics team for this pickup.
                  </p>
                  <button
                    type="submit"
                    disabled={isPending("requestDocket")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("requestDocket") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("requestDocket") ? "Requesting..." : "Request Docket from Logistics"}
                  </button>
                </form>
              )}

              {/* Mark Picked Up */}
              {request.status === "INSPECTED" && (
                <form action={async (formData) => handleAction("markAsPickedUp", formData)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="pickupDate" className="text-sm font-medium text-foreground">Pickup Date</label>
                      <input
                        id="pickupDate"
                        name="pickupDate"
                        type="date"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="docketNumber" className="text-sm font-medium text-foreground">Docket Number</label>
                      <input
                        id="docketNumber"
                        name="docketNumber"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Docket / AWB number"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isPending("markAsPickedUp")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("markAsPickedUp") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("markAsPickedUp") ? "Updating..." : "Mark as Picked Up"}
                  </button>
                </form>
              )}

              {/* Receive at Warehouse */}
              {request.status === "PICKED_UP" && (
                <form action={async (formData) => handleAction("receiveAtWarehouse", formData)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">
                        Warehouse <span className="text-red-500">*</span>
                      </label>
                      <ManageableDropdown
                        name="warehouseLocation"
                        placeholder="Select warehouse..."
                        value={warehouseLocation}
                        onChange={setWarehouseLocation}
                        options={dropdownData?.warehouseLocation ?? []}
                        allOptions={dropdownData?.allOptions ?? []}
                        category="warehouseLocation"
                        onAdd={handleAdd}
                        onDelete={handleDelete}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="receivedDate" className="text-sm font-medium text-foreground">Received Date</label>
                      <input
                        id="receivedDate"
                        name="receivedDate"
                        type="date"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="receivedBy" className="text-sm font-medium text-foreground">Received By</label>
                      <input
                        id="receivedBy"
                        name="receivedBy"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Person name"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isPending("receiveAtWarehouse")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("receiveAtWarehouse") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("receiveAtWarehouse") ? "Updating..." : "Receive at Warehouse"}
                  </button>
                </form>
              )}

              {/* Record QC */}
              {request.status === "RECEIVED_AT_WAREHOUSE" && (
                <form action={async (formData) => handleAction("recordQc", formData)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="qcResult" className="text-sm font-medium text-foreground">
                        QC Result <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="qcResult"
                        name="qcResult"
                        required
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="">Select result...</option>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="qcDate" className="text-sm font-medium text-foreground">QC Date</label>
                      <input
                        id="qcDate"
                        name="qcDate"
                        type="date"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="qcPerformedBy" className="text-sm font-medium text-foreground">Performed By</label>
                      <input
                        id="qcPerformedBy"
                        name="qcPerformedBy"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="QC engineer name"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="qcRemarks" className="text-sm font-medium text-foreground">QC Remarks</label>
                    <textarea
                      id="qcRemarks"
                      name="qcRemarks"
                      rows={2}
                      className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                      placeholder="QC remarks..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isPending("recordQc")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("recordQc") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("recordQc") ? "Recording..." : "Record QC"}
                  </button>
                </form>
              )}

              {/* Request E-Way Bill from Finance */}
              {request.status === "DC_GENERATED" && (
                <form action={async (formData) => handleAction("requestEwayBill", formData)} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    DC has been generated. Request an E-Way bill from the Finance team.
                  </p>
                  <button
                    type="submit"
                    disabled={isPending("requestEwayBill")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("requestEwayBill") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("requestEwayBill") ? "Requesting..." : "Request E-Way Bill from Finance"}
                  </button>
                </form>
              )}

              {/* Upload Blanco Certificate */}
              {request.status === "EWAY_BILL_GENERATED" && (
                <form action={async (formData) => handleAction("uploadBlancoCertificate", formData)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="blancoCertificateUrl" className="text-sm font-medium text-foreground">
                        Blanco Certificate URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="blancoCertificateUrl"
                        name="blancoCertificateUrl"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="https://..."
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="blancoCertificateDate" className="text-sm font-medium text-foreground">Certificate Date</label>
                      <input
                        id="blancoCertificateDate"
                        name="blancoCertificateDate"
                        type="date"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isPending("uploadBlancoCertificate")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("uploadBlancoCertificate") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("uploadBlancoCertificate") ? "Uploading..." : "Upload Blanco Certificate"}
                  </button>
                </form>
              )}

              {/* Request DC from Finance */}
              {request.status === "QC_COMPLETED" && (
                <form action={async (formData) => handleAction("requestDc", formData)} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Request a reverse DC (Delivery Challan) from the Finance team.
                  </p>
                  <button
                    type="submit"
                    disabled={isPending("requestDc")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("requestDc") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("requestDc") ? "Requesting..." : "Request DC from Finance"}
                  </button>
                </form>
              )}

              {/* Complete - Final Disposition */}
              {request.status === "BLANCO_CERTIFIED" && (
            <form action={async (formData) => handleAction("completeReversePickup", formData)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Final Disposition <span className="text-red-500">*</span>
                  </label>
                  <ManageableDropdown
                    name="finalDisposition"
                    placeholder="Select disposition..."
                    value={finalDisposition}
                    onChange={setFinalDisposition}
                    options={dropdownData?.disposition ?? []}
                    allOptions={dropdownData?.allOptions ?? []}
                    category="disposition"
                    onAdd={handleAdd}
                    onDelete={handleDelete}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="inventoryItemId" className="text-sm font-medium text-foreground">Link Inventory Item</label>
                  <select
                    id="inventoryItemId"
                    name="inventoryItemId"
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Skip (no link)</option>
                    {availableItems.map(item => (
                      <option key={item.id} value={item.id}>{item.serialNumber} — {item.model}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={isPending("completeReversePickup")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending("completeReversePickup") ? <Loader2 className="size-4 animate-spin" /> : null}
                {isPending("completeReversePickup") ? "Completing..." : "Complete Request"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Docket Requested - Awaiting Logistics */}
      {request.status === "DOCKET_REQUESTED" && (
        <div className="rounded-xl glass shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-50 border border-orange-200">
            <Loader2 className="size-5 text-orange-600 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Awaiting Logistics</p>
              <p className="text-xs text-orange-700 mt-0.5">
                Docket number has been requested from Logistics. Once assigned, you can proceed with inspection.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DC Requested - Awaiting Finance */}
      {request.status === "DC_REQUESTED" && (
        <div className="rounded-xl glass shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-50 border border-orange-200">
            <Loader2 className="size-5 text-orange-600 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Awaiting Finance</p>
              <p className="text-xs text-orange-700 mt-0.5">
                DC has been requested from Finance. Once generated, you can proceed with the next steps.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DC Generated */}
      {request.status === "DC_GENERATED" && (
        <div className="rounded-xl glass shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-indigo-50 border border-indigo-200">
            <FileText className="size-5 text-indigo-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">DC Generated</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                DC has been generated. You can now request an E-Way bill from Finance.
              </p>
              {dcId && (
                <a href={`/api/dc/${dcId}/pdf`} target="_blank" className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline">
                  <FileText className="size-3" />
                  View DC PDF
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* E-Way Bill Requested - Awaiting Finance */}
      {request.status === "EWAY_BILL_REQUESTED" && (
        <div className="rounded-xl glass shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
            <Loader2 className="size-5 text-yellow-600 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">Awaiting Finance</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                E-Way bill has been requested from Finance. Once generated, you can upload the Blanco certificate.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* E-Way Bill Generated */}
      {request.status === "EWAY_BILL_GENERATED" && (
        <div className="rounded-xl glass shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-indigo-50 border border-indigo-200">
            <FileText className="size-5 text-indigo-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">E-Way Bill Generated</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                E-Way bill has been generated. Upload the Blanco certificate to proceed.
              </p>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* Completed State */}
      {request.status === "COMPLETED" && (
        <div className="rounded-xl glass shadow-sm p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
            <Check className="size-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Request Completed</h3>
          <p className="text-muted-foreground mt-1">
            Final disposition: <span className="font-medium">{request.finalDisposition}</span>
          </p>
          {request.blancoCertificateUrl && (
            <a
              href={request.blancoCertificateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-primary text-sm font-semibold hover:underline"
            >
              <FileText className="size-4" />
              View Blanco Certificate
            </a>
          )}
        </div>
      )}
    </div>
  );
}
