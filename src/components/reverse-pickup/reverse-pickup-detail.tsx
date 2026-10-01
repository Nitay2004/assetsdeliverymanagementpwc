"use client";

import { useState, useCallback, useEffect, FormEvent } from "react";
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
  recordCleanQc,
  recordPurgeQc,
  requestEwayBill,
  uploadBlancoCertificate,
  uploadPodDocument,
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
  expectedPickupDate: string | null;
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
  qcCleanResult: string | null;
  qcCleanRemarks: string | null;
  qcCleanDate: string | null;
  qcCleanBy: string | null;
  qcPurgeResult: string | null;
  qcPurgeRemarks: string | null;
  qcPurgeDate: string | null;
  qcPurgeBy: string | null;
  blanccoYesNo: string | null;
  blanccoDate: string | null;
  blancoCertificateUrl: string | null;
  blancoCertificateDate: string | null;
  podDocumentUrl: string | null;
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

interface Props {
  request: RequestData;
  userRole: string;
  dcId: string | null;
}

const STEPS = [
  { key: "REQUESTED", label: "Requested", icon: Circle },
  { key: "PARTNER_ASSIGNED", label: "Partner Assigned", icon: Truck },
  { key: "DOCKET_REQUESTED", label: "Docket Req.", icon: FileText },
  { key: "DC_REQUESTED", label: "DC Req.", icon: FileText },
  { key: "DC_GENERATED", label: "DC Gen.", icon: FileText },
  { key: "EWAY_BILL_REQUESTED", label: "E-Way Req.", icon: FileText },
  { key: "EWAY_BILL_GENERATED", label: "E-Way Gen.", icon: FileText },
  { key: "INSPECTED", label: "Inspected", icon: ClipboardCheck },
  { key: "PICKED_UP", label: "Picked Up", icon: Truck },
  { key: "RECEIVED_AT_WAREHOUSE", label: "At Warehouse", icon: Warehouse },
  { key: "QC_CLEANED", label: "Clean QC", icon: ShieldCheck },
  { key: "QC_COMPLETED", label: "QC Completed", icon: ShieldCheck },
  { key: "BLANCO_CERTIFIED", label: "Blanco Cert", icon: FileText },
  { key: "COMPLETED", label: "Completed", icon: Package },
];

export function ReversePickupDetail({ request, userRole, dcId }: Props) {
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

  const INITIAL_STAGE_STATUSES = ["GATEPASS_PENDING", "PENDING", "PWC_CONFIRMATION_AWAITED", "ALIGN_FOR_PICKUP", "ON_HOLD"];
  const PICKED_UP_EQUIVALENT = ["IN_TRANSIT"];
  const NON_EDITABLE_STATUSES = ["COMPLETED", "PICKUP_CANCELLED", "DUPLICATE", "ALREADY_SUBMITTED_TO_PWC_OFFICE", "RTO_CASE", "LOST_DEVICE"];

  let effectiveStatus = request.status;
  if (INITIAL_STAGE_STATUSES.includes(request.status)) effectiveStatus = "REQUESTED";
  else if (PICKED_UP_EQUIVALENT.includes(request.status)) effectiveStatus = "PICKED_UP";

  const isReadOnly = NON_EDITABLE_STATUSES.includes(request.status);
  const stepStatus = effectiveStatus;
  const currentStepIndex = STEPS.findIndex(s => s.key === stepStatus);
  const nextAction = getNextStatus(stepStatus);

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
        recordCleanQc,
        recordPurgeQc,
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

  const handleUploadBlanco = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("blancoCertificateFile") as File | null;
    const date = formData.get("blancoCertificateDate") as string | null;

    if (!file) {
      toast({ title: "Error", description: "Please select a certificate file.", variant: "error" });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      toast({ title: "Error", description: "Only PDF, JPG, JPEG and PNG files are allowed.", variant: "error" });
      return;
    }

    setLoading("uploadBlancoCertificate");
    try {
      const uploadFd = new FormData();
      uploadFd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: uploadFd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const actionFd = new FormData();
      actionFd.set("id", request.id);
      actionFd.set("blancoCertificateUrl", data.url);
      actionFd.set("blancoCertificateDate", date ?? "");
      await uploadBlancoCertificate(actionFd);

      toast({ title: "Action completed successfully", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({ title: "Action failed", description: String(err), variant: "error" });
    } finally {
      setLoading(null);
    }
  };

  const handleViewBlanco = async () => {
    const path = request.blancoCertificateUrl;
    if (!path) return;
    try {
      if (/^https?:\/\//i.test(path)) {
        window.open(path, "_blank");
        return;
      }
      const res = await fetch(`/api/pod-url?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load certificate");
      window.open(data.url, "_blank");
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "error" });
    }
  };

  const handleUploadPod = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("podDocumentFile") as File | null;

    if (!file) {
      toast({ title: "Error", description: "Please select a POD file.", variant: "error" });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      toast({ title: "Error", description: "Only PDF, JPG, JPEG and PNG files are allowed.", variant: "error" });
      return;
    }

    setLoading("uploadPodDocument");
    try {
      const uploadFd = new FormData();
      uploadFd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: uploadFd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const actionFd = new FormData();
      actionFd.set("id", request.id);
      actionFd.set("podDocumentUrl", data.url);
      await uploadPodDocument(actionFd);

      toast({ title: "Action completed successfully", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({ title: "Action failed", description: String(err), variant: "error" });
    } finally {
      setLoading(null);
    }
  };

  const handleViewPod = async () => {
    const path = request.podDocumentUrl;
    if (!path) return;
    try {
      if (/^https?:\/\//i.test(path)) {
        window.open(path, "_blank");
        return;
      }
      const res = await fetch(`/api/pod-url?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load POD");
      window.open(data.url, "_blank");
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "error" });
    }
  };

  const STATUS_STYLES: Record<string, { label: string; color: string }> = {
    REQUESTED:              { label: "Requested",              color: "bg-yellow-100 text-yellow-700" },
    PARTNER_ASSIGNED:       { label: "Partner Assigned",       color: "bg-blue-100 text-blue-700" },
    DOCKET_REQUESTED:       { label: "Docket Requested",       color: "bg-orange-100 text-orange-700" },
    INSPECTED:              { label: "Inspected",              color: "bg-indigo-100 text-indigo-700" },
    PICKED_UP:              { label: "Picked Up",              color: "bg-purple-100 text-purple-700" },
    PICKUP_CANCELLED:       { label: "Pickup Cancelled",       color: "bg-red-100 text-red-700" },
    DUPLICATE:              { label: "Duplicate",              color: "bg-gray-200 text-gray-700" },
    ALREADY_SUBMITTED_TO_PWC_OFFICE: { label: "Submitted to PWC Office", color: "bg-slate-100 text-slate-700" },
    PENDING:                { label: "Pending",                color: "bg-orange-100 text-orange-700" },
    PWC_CONFIRMATION_AWAITED: { label: "PwC Confirmation Awaited", color: "bg-amber-100 text-amber-700" },
    GATEPASS_PENDING:       { label: "Gatepass Pending",       color: "bg-teal-100 text-teal-700" },
    ALIGN_FOR_PICKUP:       { label: "Align for Pickup",       color: "bg-cyan-100 text-cyan-700" },
    IN_TRANSIT:             { label: "In Transit",             color: "bg-sky-100 text-sky-700" },
    ON_HOLD:                { label: "On Hold",                color: "bg-zinc-100 text-zinc-700" },
    RTO_CASE:               { label: "RTO Case",               color: "bg-rose-100 text-rose-700" },
    LOST_DEVICE:            { label: "Lost Device",            color: "bg-stone-100 text-stone-700" },
    RECEIVED_AT_WAREHOUSE:  { label: "At Warehouse",           color: "bg-cyan-100 text-cyan-700" },
    QC_CLEANED:             { label: "Clean QC",               color: "bg-lime-100 text-lime-700" },
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

        {/* SLA & TAT — all values derived on the server from the email hour, the
            pickup location and the ODA flag. */}
        {(request.emailReceivedHour || request.zone1 || request.tier1 || request.sla) && (
          <div className="rounded-xl glass shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">SLA &amp; TAT</h3>
            <div className="space-y-2 text-sm">
              {request.emailReceivedHour && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email Received Hour</span>
                  <span>{request.emailReceivedHour}</span>
                </div>
              )}
              {request.cutOffStatus && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cut Off Status</span>
                  <span>{request.cutOffStatus}</span>
                </div>
              )}
              {request.slaStartDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SLA Start Date</span>
                  <span>{new Date(request.slaStartDate).toLocaleDateString("en-GB")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zone</span>
                <span>{request.zone1 || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tier</span>
                <span>{request.tier1 || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ODA Location</span>
                <span>{request.odaLocation || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TAT</span>
                <span>{request.tat ? `${request.tat} days` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Pickup Date</span>
                <span>{request.expectedPickupDate ? new Date(request.expectedPickupDate).toLocaleDateString("en-GB") : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual Pickup Date</span>
                <span>{request.pickupDate ? new Date(request.pickupDate).toLocaleDateString("en-GB") : "—"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">SLA</span>
                {request.sla ? (
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    request.sla === "Met"
                      ? "bg-green-100 text-green-700"
                      : request.sla === "Missed"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"
                  }`}>{request.sla}</span>
                ) : (
                  <span className="text-muted-foreground italic">—</span>
                )}
              </div>
            </div>
          </div>
        )}

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
              {request.qcCleanResult && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Clean QC</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    request.qcCleanResult === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>{request.qcCleanResult}</span>
                </div>
              )}
              {request.qcPurgeResult && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Purge QC</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    request.qcPurgeResult === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>{request.qcPurgeResult}</span>
                </div>
              )}
              {request.qcResult && (
                <div className="flex justify-between items-center">
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
          {(request.displayStatus || request.dependency || request.courierName || request.docketNumber || request.dcNo || request.actualDeliveryPodDate || request.podDocumentUrl) && (
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
                {request.actualDeliveryPodDate && <div className="flex justify-between"><span className="text-muted-foreground">POD Date</span><span>{new Date(request.actualDeliveryPodDate).toLocaleDateString("en-GB")}</span></div>}
                {request.podDocumentUrl && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">POD PDF</span>
                    <button onClick={handleViewPod} className="text-primary font-semibold hover:underline text-sm">View</button>
                  </div>
                )}
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
          <div className="rounded-xl glass shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">POD Document</h2>
              {request.podDocumentUrl && (
                <button
                  onClick={handleViewPod}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold text-primary hover:bg-accent"
                >
                  <FileText className="size-4" />
                  View POD
                </button>
              )}
            </div>
            <form onSubmit={handleUploadPod} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="podDocumentFile" className="text-sm font-medium text-foreground">
                    POD File
                  </label>
                  <input
                    id="podDocumentFile"
                    name="podDocumentFile"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-muted-foreground">PDF, JPG, JPEG or PNG</p>
                </div>
                <div className="space-y-1.5 self-end">
                  <button
                    type="submit"
                    disabled={isPending("uploadPodDocument")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("uploadPodDocument") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("uploadPodDocument") ? "Uploading..." : request.podDocumentUrl ? "Replace POD" : "Upload POD"}
                  </button>
                </div>
              </div>
            </form>
          </div>
          {nextAction && (
            <div className="rounded-xl glass shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                Next Step: {nextAction.label}
              </h2>

              {/* Assign Partner */}
              {effectiveStatus === "REQUESTED" && (
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
                        value={request.docketNumber ?? ""}
                        readOnly
                        className="flex h-10 w-full rounded-lg border border-input/50 bg-muted/20 px-3 py-2 text-sm text-muted-foreground shadow-sm"
                        placeholder="Auto-filled from logistics"
                      />
                      {request.docketNumber ? (
                        <p className="text-xs text-emerald-600 font-medium">Assigned by logistics.</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No docket assigned yet.</p>
                      )}
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
              {effectiveStatus === "PICKED_UP" && (
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

              {/* Record Clean QC */}
              {request.status === "RECEIVED_AT_WAREHOUSE" && (
                <form action={async (formData) => handleAction("recordCleanQc", formData)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="qcCleanResult" className="text-sm font-medium text-foreground">
                        Clean QC Result <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="qcCleanResult"
                        name="qcCleanResult"
                        required
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="">Select result...</option>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="qcCleanDate" className="text-sm font-medium text-foreground">Clean QC Date</label>
                      <input
                        id="qcCleanDate"
                        name="qcCleanDate"
                        type="date"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="qcCleanBy" className="text-sm font-medium text-foreground">Performed By</label>
                      <input
                        id="qcCleanBy"
                        name="qcCleanBy"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="QC engineer name"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="qcCleanRemarks" className="text-sm font-medium text-foreground">Clean QC Remarks</label>
                    <textarea
                      id="qcCleanRemarks"
                      name="qcCleanRemarks"
                      rows={2}
                      className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                      placeholder="Clean QC remarks..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isPending("recordCleanQc")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("recordCleanQc") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("recordCleanQc") ? "Recording..." : "Record Clean QC"}
                  </button>
                </form>
              )}

              {/* Record Purge QC */}
              {request.status === "QC_CLEANED" && (
                <form action={async (formData) => handleAction("recordPurgeQc", formData)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="qcPurgeResult" className="text-sm font-medium text-foreground">
                        Purge QC Result <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="qcPurgeResult"
                        name="qcPurgeResult"
                        required
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="">Select result...</option>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="qcPurgeDate" className="text-sm font-medium text-foreground">Purge QC Date</label>
                      <input
                        id="qcPurgeDate"
                        name="qcPurgeDate"
                        type="date"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="qcPurgeBy" className="text-sm font-medium text-foreground">Performed By</label>
                      <input
                        id="qcPurgeBy"
                        name="qcPurgeBy"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="QC engineer name"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="qcPurgeRemarks" className="text-sm font-medium text-foreground">Purge QC Remarks</label>
                    <textarea
                      id="qcPurgeRemarks"
                      name="qcPurgeRemarks"
                      rows={2}
                      className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                      placeholder="Purge QC remarks..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isPending("recordPurgeQc")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("recordPurgeQc") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("recordPurgeQc") ? "Recording..." : "Record Purge QC"}
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

              {/* Record Inspection */}
              {request.status === "EWAY_BILL_GENERATED" && (
                <form action={async (formData) => handleAction("recordInspection", formData)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="inspectionDate" className="text-sm font-medium text-foreground">Inspection Date</label>
                      <input
                        id="inspectionDate"
                        name="inspectionDate"
                        type="date"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="inspectionRemarks" className="text-sm font-medium text-foreground">Inspection Remarks</label>
                      <textarea
                        id="inspectionRemarks"
                        name="inspectionRemarks"
                        rows={2}
                        className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                        placeholder="Inspection remarks..."
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isPending("recordInspection")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("recordInspection") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("recordInspection") ? "Recording..." : "Record Inspection"}
                  </button>
                </form>
              )}

              {/* Upload Blanco Certificate */}
              {request.status === "QC_COMPLETED" && (
                <form onSubmit={handleUploadBlanco} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="blancoCertificateFile" className="text-sm font-medium text-foreground">
                        Blanco Certificate <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="blancoCertificateFile"
                        name="blancoCertificateFile"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        required
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <p className="text-xs text-muted-foreground">PDF, JPG, JPEG or PNG</p>
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

              {/* Move Back to Inventory */}
              {request.status === "BLANCO_CERTIFIED" && (
                <form action={async (formData) => handleAction("completeReversePickup", formData)} className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-teal-50 border border-teal-200">
                    <Package className="size-5 text-teal-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-teal-800">Blanco certification complete</p>
                      <p className="text-xs text-teal-700 mt-0.5">
                        The laptop will be moved back to inventory and this request will be marked as completed.
                      </p>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isPending("completeReversePickup")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending("completeReversePickup") ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isPending("completeReversePickup") ? "Moving..." : "Move Back to Inventory"}
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
                Docket number has been requested from Logistics. Once assigned, you can proceed with DC &amp; E-Way bill.
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
                DC has been requested from Finance. Once generated, you can request the E-Way bill.
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
                E-Way bill has been requested from Finance. Once generated, you can record inspection.
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
                E-Way bill has been generated. Record inspection to proceed with pickup.
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
            <button
              type="button"
              onClick={handleViewBlanco}
              className="inline-flex items-center gap-1.5 mt-3 text-primary text-sm font-semibold hover:underline"
            >
              <FileText className="size-4" />
              View Blanco Certificate
            </button>
          )}
        </div>
      )}

      {/* Read-Only / Closed State */}
      {isReadOnly && request.status !== "COMPLETED" && (
        <div className="rounded-xl glass shadow-sm p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
            <Circle className="size-6 text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{currentStyle.label}</h3>
          <p className="text-muted-foreground mt-1">
            This request is closed and cannot be edited.
          </p>
        </div>
      )}
    </div>
  );
}
