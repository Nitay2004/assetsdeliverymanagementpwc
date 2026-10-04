import { readFileSync } from "fs";
import path from "path";
import pdfmake from "pdfmake";
import virtualfs from "pdfmake/js/virtual-fs";
import vfs from "pdfmake/build/vfs_fonts";

interface DcPdfData {
  dcNumber: string;
  dcDate: string;
  // Reverse pickup challans are titled separately so the return leg is never
  // mistaken for a forward delivery challan.
  documentTitle?: string;
  // Reverse pickup DCs have no payment terms, so the row is dropped entirely
  // instead of being printed empty.
  includeModeOfPayment?: boolean;
  warehouseName?: string | null;
  shipToLocation?: string | null;
  billToLocation?: string | null;
  userName?: string | null;
  userContact?: string | null;
  modeOfPayment?: string | null;
  referenceNo?: string | null;
  referenceDate?: string | null;
  otherReferences?: string | null;
  buyersOrderNo?: string | null;
  buyersOrderDate?: string | null;
  dispatchDocNo?: string | null;
  dispatchedThrough?: string | null;
  destination?: string | null;
  termsOfDelivery?: string | null;
  amountInWords?: string | null;
  taxableValue: number | null;
  igst: number | null;
  totalTaxAmount: number | null;
  taxAmountInWords?: string | null;
  items: Array<{
    description: string;
    hsnSac?: string | null;
    quantity: number;
    rate: number;
    amount: number;
    taxableValue?: number | null;
    igstRate?: number | null;
    igstAmount?: number | null;
  }>;
}

const FONT_PREFIX = "pwc-dc-font-";

const LOGO_PATH = path.join(process.cwd(), "public", "devit-logo.png");

function readLogo(): { dataUrl: string; width: number; height: number } | null {
  try {
    const buffer = readFileSync(LOGO_PATH);
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { dataUrl: `data:image/png;base64,${buffer.toString("base64")}`, width, height };
  } catch {
    return null;
  }
}

function initFonts() {
  for (const [name, key] of Object.entries({
    "Roboto-Regular.ttf": "normal",
    "Roboto-Medium.ttf": "bold",
    "Roboto-Italic.ttf": "italics",
    "Roboto-MediumItalic.ttf": "bolditalics",
  })) {
    const vfsKey = `${FONT_PREFIX}${name}`;
    if (!virtualfs.existsSync(vfsKey)) {
      virtualfs.writeFileSync(vfsKey, Buffer.from(vfs[name], "base64"));
    }
  }
  pdfmake.setFonts({
    Roboto: {
      normal: `${FONT_PREFIX}Roboto-Regular.ttf`,
      bold: `${FONT_PREFIX}Roboto-Medium.ttf`,
      italics: `${FONT_PREFIX}Roboto-Italic.ttf`,
      bolditalics: `${FONT_PREFIX}Roboto-MediumItalic.ttf`,
    },
  });
}

initFonts();

export async function generateDcPdf(data: DcPdfData, clientName: string): Promise<Buffer> {
  const TOP_MARGIN = 50;
  const LOGO_WIDTH = 56;
  const logo = readLogo();
  const logoHeight = logo ? (LOGO_WIDTH * logo.height) / logo.width : 0;
  const logoTop = logoHeight > 0 ? TOP_MARGIN - logoHeight : 0;

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const header = () => [
    { text: data.documentTitle || "DELIVERY CHALLAN", style: "title", alignment: "center" },
    {
      columns: [
        { text: `DC No: ${data.dcNumber}`, style: "fieldValue" },
        { text: `Date: ${formatDate(data.dcDate)}`, style: "fieldValue", alignment: "right" },
      ],
      margin: [0, 16, 0, 4],
    },
  ];

  const divider = { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }], margin: [0, 4, 0, 4] };

  const dd = {
    pageSize: "A4" as const,
    pageMargins: [40, TOP_MARGIN, 40, 40] as [number, number, number, number],
    defaultStyle: { font: "Roboto", fontSize: 9 },
    styles: {
      title: { fontSize: 14, bold: true, color: "#1e40af" },
      sectionTitle: { fontSize: 10, bold: true, color: "#1e40af", margin: [0, 6, 0, 3] },
      fieldLabel: { fontSize: 8.5, bold: true, color: "#374151" },
      fieldValue: { fontSize: 8.5, color: "#111827" },
      tableHeader: { fontSize: 8.5, bold: true, fillColor: "#e5e7eb", color: "#1f2937", alignment: "center" as const, margin: [2, 4, 2, 4] },
      tableCell: { fontSize: 8, color: "#111827", margin: [2, 3, 2, 3] },
      tableCellRight: { fontSize: 8, color: "#111827", margin: [2, 3, 2, 3], alignment: "right" as const },
      totalLabel: { fontSize: 9, bold: true, color: "#1f2937" },
      totalValue: { fontSize: 9, bold: true, color: "#1f2937", alignment: "right" as const },
      wordsLabel: { fontSize: 9, bold: true, color: "#374151" },
      wordsValue: { fontSize: 9, color: "#dc2626", bold: true },
    },
    content: [
      ...(logo && logoHeight > 0
        ? [{ image: logo.dataUrl, width: LOGO_WIDTH, absolutePosition: { x: 40, y: logoTop } }]
        : []),
      ...header(),

      divider,

      {
        table: {
          widths: ["30%", "*"],
          body: [
            [
              { text: "PARTY DETAILS", style: "sectionTitle", colSpan: 2, alignment: "left", border: [false, false, false, true] },
              {},
            ],
            [{ text: "From Warehouse", style: "fieldLabel" }, { text: data.warehouseName || "—", style: "fieldValue" }],
            [{ text: "User Name", style: "fieldLabel" }, { text: data.userName || "—", style: "fieldValue" }],
            [{ text: "User Contact Details", style: "fieldLabel" }, { text: data.userContact || "—", style: "fieldValue" }],
            [{ text: "Ship To Location", style: "fieldLabel" }, { text: data.shipToLocation || "—", style: "fieldValue" }],
            [{ text: "Bill To Location", style: "fieldLabel" }, { text: data.billToLocation || "—", style: "fieldValue" }],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#d1d5db",
          vLineColor: () => "#d1d5db",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },

      {
        table: {
          widths: ["30%", "*"],
          body: [
            [{ text: "REFERENCE DETAILS", style: "sectionTitle", colSpan: 2, alignment: "left", border: [false, false, false, true] }, {}],
            ...(data.includeModeOfPayment === false
              ? []
              : [[{ text: "Mode / Terms of Payment", style: "fieldLabel" }, { text: data.modeOfPayment || "—", style: "fieldValue" }]]),
            [{ text: "Reference No. & Date", style: "fieldLabel" }, { text: `${data.referenceNo || ""} ${data.referenceNo && data.referenceDate ? "/" : ""} ${formatDate(data.referenceDate)}`, style: "fieldValue" }],
            [{ text: "Other References", style: "fieldLabel" }, { text: data.otherReferences || "—", style: "fieldValue" }],
            [{ text: "Buyer's Order No. & Date", style: "fieldLabel" }, { text: `${data.buyersOrderNo || ""} ${data.buyersOrderNo && data.buyersOrderDate ? "/" : ""} ${formatDate(data.buyersOrderDate)}`, style: "fieldValue" }],
            [{ text: "Dispatch Doc No.", style: "fieldLabel" }, { text: data.dispatchDocNo || "—", style: "fieldValue" }],
            [{ text: "Dispatched Through", style: "fieldLabel" }, { text: data.dispatchedThrough || "—", style: "fieldValue" }],
            [{ text: "Destination", style: "fieldLabel" }, { text: data.destination || "—", style: "fieldValue" }],
            [{ text: "Terms of Delivery", style: "fieldLabel" }, { text: data.termsOfDelivery || "—", style: "fieldValue" }],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#d1d5db",
          vLineColor: () => "#d1d5db",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },

      { text: " ", margin: [0, 4, 0, 0] },

      { text: "ITEM DETAILS", style: "sectionTitle" },
      {
        table: {
          headerRows: 1,
          widths: [140, 52, 52, 52, 52, 52, 52],
          body: [
            [
              { text: "Description of Goods", style: "tableHeader" },
              { text: "HSN/SAC", style: "tableHeader" },
              { text: "Qty", style: "tableHeader" },
              { text: "Rate (INR)", style: "tableHeader" },
              { text: "Amount (INR)", style: "tableHeader" },
              { text: "Taxable Value", style: "tableHeader" },
              { text: "IGST", style: "tableHeader" },
            ],
            ...data.items.map((item) => [
              { text: item.description, style: "tableCell" },
              { text: item.hsnSac || "—", style: "tableCell", alignment: "center" as const },
              { text: String(item.quantity), style: "tableCellRight" },
              { text: item.rate.toLocaleString("en-IN", { minimumFractionDigits: 2 }), style: "tableCellRight" },
              { text: item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }), style: "tableCellRight" },
              { text: (item.taxableValue ?? item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 }), style: "tableCellRight" },
              { text: (item.igstAmount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }), style: "tableCellRight" },
            ]),
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#d1d5db",
          vLineColor: () => "#d1d5db",
          paddingLeft: () => 4,
          paddingRight: () => 4,
        },
      },

      { text: " ", margin: [0, 4, 0, 0] },

      {
        table: {
          widths: ["*", 100],
          body: [
            [{ text: "CHARGES SUMMARY", style: "sectionTitle", colSpan: 2, alignment: "left", border: [false, false, false, true] }, {}],
            [
              { text: "Total Taxable Value", style: "totalLabel" },
              { text: (data.taxableValue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }), style: "totalValue" },
            ],
            [
              { text: "IGST", style: "totalLabel" },
              { text: (data.igst ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }), style: "totalValue" },
            ],
            [
              { text: "Total Tax Amount", style: "totalLabel" },
              { text: (data.totalTaxAmount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }), style: "totalValue" },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#d1d5db",
          vLineColor: () => "#d1d5db",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },

      { text: " ", margin: [0, 2, 0, 0] },
      { columns: [
        { text: "Amount Chargeable (in words):", style: "wordsLabel", width: 160 },
        { text: data.amountInWords || "—", style: "wordsValue", width: "*" },
      ]},
      { columns: [
        { text: "Tax Amount (in words):", style: "wordsLabel", width: 160 },
        { text: data.taxAmountInWords || "—", style: "wordsValue", width: "*" },
      ]},

      { text: " ", margin: [0, 8, 0, 0] },

      {
        columns: [
          { text: `Client: ${clientName}`, style: "fieldValue", alignment: "left" },
          { text: "Authorised Signatory", style: "fieldValue", alignment: "right" },
        ],
      },
    ],
  };

  const outputDoc = pdfmake.createPdf(dd);
  return outputDoc.getBuffer();
}
