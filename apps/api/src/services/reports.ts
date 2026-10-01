import type { PrismaClient } from "@medilab/db";
import type {
  FinanceAnalyticsPayload,
  PrintableAnalyticsPayload,
  ReportInput,
} from "@medilab/shared";
import PDFDocument from "pdfkit";
import sanitizeHtml from "sanitize-html";
import { access, mkdir, readFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";

const storageRoot =
  process.env.MEDILAB_STORAGE_ROOT?.trim() ||
  path.resolve(process.cwd(), "storage");
const reportsDir = path.join(storageRoot, "reports");
const brandSvgMarkup = `<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="18" y1="10" x2="104" y2="110" gradientUnits="userSpaceOnUse"><stop stop-color="#0F6BFF"/><stop offset="1" stop-color="#00C4B4"/></linearGradient><linearGradient id="rod" x1="44" y1="18" x2="82" y2="94" gradientUnits="userSpaceOnUse"><stop stop-color="#E7FBFF"/><stop offset="1" stop-color="#9ED7FF"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="#0F172A"/><rect width="120" height="120" rx="28" fill="url(#bg)" fill-opacity="0.24"/><path d="M37 15C53 25 71 42 76 60C80 77 70 88 56 100" stroke="url(#bg)" stroke-width="8" stroke-linecap="round"/><path d="M83 15C67 25 49 42 44 60C40 77 50 88 64 100" stroke="#7CC6FF" stroke-width="8" stroke-linecap="round"/><path d="M45 30H75" stroke="url(#rod)" stroke-width="5" stroke-linecap="round"/><path d="M39 48H81" stroke="url(#rod)" stroke-width="5" stroke-linecap="round"/><path d="M39 70H81" stroke="url(#rod)" stroke-width="5" stroke-linecap="round"/><path d="M45 90H75" stroke="url(#rod)" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="60" r="10" fill="#F8FFFF" fill-opacity="0.96"/><path d="M60 53V67" stroke="#0F6BFF" stroke-width="4" stroke-linecap="round"/><path d="M53 60H67" stroke="#0F6BFF" stroke-width="4" stroke-linecap="round"/></svg>`;
const brandSvgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(brandSvgMarkup)}`;
const developerCredit = "Software developed by OmniWeave Softwares.";
const developerTagline = "Weaving Digital Solutions for Africa.";

type FacilityProfile = {
  name: string;
  code: string;
  phone: string;
  email: string;
  location: string;
  logoDataUrl: string;
  footerMessage: string;
  printFontSize: "SMALL" | "MEDIUM" | "LARGE";
  showFacilityProfileOnPrint: boolean;
};

function sanitizeFilePart(value: string) {
  return value
    .replace(/[^a-z0-9_-]+/giu, "-")
    .replace(/-{2,}/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function formatStatusLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function blockify(value: string) {
  return escapeHtml(value).replace(/\n/gu, "<br />");
}

function plainTextToHtml(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .split(/\n{2,}/u)
    .map((paragraph) => `<p>${blockify(paragraph)}</p>`)
    .join("");
}

function renderRichText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const source = /<\/?[a-z][^>]*>/iu.test(trimmed)
    ? trimmed
    : plainTextToHtml(trimmed);

  return sanitizeHtml(source, {
    allowedTags: [
      "div",
      "p",
      "br",
      "h1",
      "h2",
      "h3",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "mark",
      "ul",
      "ol",
      "li",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "span",
    ],
    allowedAttributes: {
      "*": ["style"],
      div: ["data-page-break", "class"],
      img: ["src", "alt", "title", "width", "height"],
    },
    allowedSchemesAppliedToAttributes: ["src"],
    allowedSchemesByTag: {
      img: ["data", "http", "https"],
    },
    allowedStyles: {
      "*": {
        "font-size": [/^\d+(?:px|pt|rem|em|%)$/u],
        "text-align": [/^(left|center|right|justify)$/u],
        color: [/^#[0-9a-f]{3,8}$/iu, /^rgb\(/iu, /^rgba\(/iu, /^hsl\(/iu, /^hsla\(/iu],
        "background-color": [/^#[0-9a-f]{3,8}$/iu, /^rgb\(/iu, /^rgba\(/iu, /^hsl\(/iu, /^hsla\(/iu],
      },
    },
  });
}

function htmlToText(value: string) {
  return value
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/giu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\n{3,}/gu, "\n\n")
    .replace(/[ \t]+/gu, " ")
    .trim();
}

function renderEchoWorksheetMarkup(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  // Echo worksheet findings are generated from structured fields whose values are
  // already escaped in the web app. Keep the worksheet's inline layout styles intact
  // so the printable output matches the on-screen template instead of collapsing into
  // a plain stacked text block.
  if (/adult echocardiography worksheet/iu.test(trimmed)) {
    return trimmed;
  }

  return renderRichText(trimmed);
}

function toFacilityProfile(
  facility:
    | {
        name: string;
        code: string;
        phone: string;
        email: string;
        location: string;
        logoDataUrl: string;
        footerMessage: string;
        printFontSize?: string;
        showFacilityProfileOnPrint?: boolean;
      }
    | null
    | undefined,
): FacilityProfile {
  const printFontSize =
    facility?.printFontSize === "SMALL" ||
    facility?.printFontSize === "LARGE" ||
    facility?.printFontSize === "MEDIUM"
      ? facility.printFontSize
      : "MEDIUM";

  return {
    name: facility?.name?.trim() || "MediLab Nexus Diagnostic Centre",
    code: facility?.code?.trim() || "MLN-ACC",
    phone: facility?.phone?.trim() || "",
    email: facility?.email?.trim() || "",
    location: facility?.location?.trim() || "",
    logoDataUrl: facility?.logoDataUrl?.trim() || "",
    footerMessage:
      facility?.footerMessage?.trim() ||
      "Generated locally by MediLab Nexus. Preserve the Patient Trace Code on all printed copies.",
    printFontSize,
    showFacilityProfileOnPrint: facility?.showFacilityProfileOnPrint ?? true,
  };
}

async function resolveFacilityProfile(
  prisma: PrismaClient,
  facilityId?: string | null,
) {
  if (facilityId?.trim()) {
    const actorFacility = await prisma.facility.findUnique({
      where: { id: facilityId },
    });
    if (actorFacility) {
      return toFacilityProfile(actorFacility);
    }
  }

  return toFacilityProfile(
    await prisma.facility.findFirst({
      orderBy: { createdAt: "asc" },
    }),
  );
}

function getFacilityLogoSrc(facility: FacilityProfile) {
  return facility.logoDataUrl || brandSvgDataUri;
}

function getFacilityWatermarkSrc(facility: FacilityProfile) {
  return facility.logoDataUrl || "";
}

function getFacilityContactLine(facility: FacilityProfile) {
  return [facility.location, facility.phone, facility.email]
    .filter(Boolean)
    .join(" · ");
}

function getDeveloperCreditLine() {
  return `${developerCredit} ${developerTagline}`;
}

function getPrintTypographyCss(facility: FacilityProfile) {
  if (facility.printFontSize === "SMALL") {
    return "--print-body-size: 12px; --print-title-size: 24px; --print-section-title-size: 17px; --print-metric-size: 16px; --print-copy-size: 13px;";
  }
  if (facility.printFontSize === "LARGE") {
    return "--print-body-size: 16px; --print-title-size: 32px; --print-section-title-size: 21px; --print-metric-size: 20px; --print-copy-size: 16px;";
  }
  return "--print-body-size: 14px; --print-title-size: 28px; --print-section-title-size: 18px; --print-metric-size: 18px; --print-copy-size: 14px;";
}

function calculateAge(
  dateOfBirth: Date | null | undefined,
  referenceDate: Date,
) {
  if (!dateOfBirth) {
    return "Not recorded";
  }

  let age = referenceDate.getFullYear() - dateOfBirth.getFullYear();
  const monthDelta = referenceDate.getMonth() - dateOfBirth.getMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && referenceDate.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1;
  }

  return `${Math.max(age, 0)} years`;
}

function formatReportDate(value: Date) {
  return value.toLocaleDateString();
}

function isEchoWorksheetReport(report: {
  title: string;
  findings: string;
}) {
  const findings = report.findings.toLowerCase();
  return (
    findings.includes("adult echocardiography worksheet") ||
    (findings.includes("doppler measurements") &&
      findings.includes("m-mode/2d measurements"))
  );
}

function getPdfImageBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/u);
  if (!match) {
    return null;
  }

  const encodedImage = match[2];
  if (!encodedImage) {
    return null;
  }

  try {
    return Buffer.from(encodedImage, "base64");
  } catch {
    return null;
  }
}

function drawPdfBrand(doc: PDFKit.PDFDocument, facility: FacilityProfile) {
  const logoBuffer = getPdfImageBuffer(facility.logoDataUrl);
  if (logoBuffer) {
    doc.save();
    try {
      doc.roundedRect(40, 30, 48, 48, 14).fillOpacity(0.08).fill("#0F6BFF");
      doc.image(logoBuffer, 44, 34, { fit: [40, 40], align: "center" });
      return;
    } catch {
      // Fall back to the built-in mark when the uploaded image format is unsupported.
    } finally {
      doc.restore();
    }
  }

  doc.save();
  doc.roundedRect(42, 32, 42, 42, 12).fillOpacity(1).fill("#0F172A");
  doc
    .moveTo(54, 42)
    .lineTo(71, 64)
    .strokeOpacity(0.95)
    .lineWidth(3)
    .stroke("#6DB7FF");
  doc
    .moveTo(72, 42)
    .lineTo(55, 64)
    .strokeOpacity(0.95)
    .lineWidth(3)
    .stroke("#00C4B4");
  doc
    .moveTo(56, 48)
    .lineTo(70, 48)
    .strokeOpacity(0.95)
    .lineWidth(2)
    .stroke("#E7FBFF");
  doc
    .moveTo(53, 58)
    .lineTo(73, 58)
    .strokeOpacity(0.95)
    .lineWidth(2)
    .stroke("#E7FBFF");
  doc
    .fontSize(8)
    .fillColor("#F8FBFF")
    .text("MN", 50, 68, { width: 26, align: "center" });
  doc.restore();
}

async function buildReportBundle(prisma: PrismaClient, reportId: string) {
  const report = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      patient: true,
      order: {
        include: {
          items: {
            include: {
              catalogItem: true,
            },
          },
        },
      },
    },
  });
  const facility = await resolveFacilityProfile(prisma, report.patient.facilityId);

  const imagePaths = JSON.parse(report.imagePathsJson) as string[];
  const fileStem = [
    report.patient.traceCode,
    sanitizeFilePart(report.title),
    report.id.slice(-6),
  ]
    .filter(Boolean)
    .join("-");
  const fileName = `${fileStem}.pdf`;

  return {
    facility,
    report,
    imagePaths,
    fileName,
    filePath: path.join(reportsDir, fileName),
  };
}

async function buildDraftReportBundle(prisma: PrismaClient, payload: ReportInput) {
  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: payload.patientId },
  });
  const order = await prisma.diagnosticOrder.findUniqueOrThrow({
    where: { id: payload.orderId },
    include: {
      items: {
        include: {
          catalogItem: true,
        },
      },
    },
  });
  const facility = await resolveFacilityProfile(prisma, patient.facilityId);
  const fileStem = [
    patient.traceCode,
    sanitizeFilePart(payload.title),
    "draft-preview",
  ]
    .filter(Boolean)
    .join("-");

  return {
    facility,
    report: {
      id: "draft-preview",
      title: payload.title,
      medicalHistory: payload.medicalHistory,
      findings: payload.findings,
      impression: payload.impression,
      signedBy: payload.signedBy,
      createdAt: new Date(),
      pdfPath: null,
      patient,
      order,
    },
    imagePaths: payload.imagePaths,
    fileName: `${fileStem}.html`,
  };
}

function composePrintableReportHtml(bundle: {
  facility: FacilityProfile;
  report: {
    id: string;
    title: string;
    medicalHistory: string | null;
    findings: string;
    impression: string;
    signedBy: string | null;
    createdAt: Date;
    pdfPath?: string | null;
    patient: {
      traceCode: string;
      firstName: string;
      lastName: string;
      gender: string | null;
      dateOfBirth: Date | null;
      location?: string | null;
    };
    order: {
      accessionNumber: string;
      items: Array<{
        catalogItem: {
          name: string;
        };
      }>;
    };
  };
  imagePaths: string[];
  fileName: string;
}) {
  const { facility, report, imagePaths, fileName } = bundle;
  const patientName = `${report.patient.firstName} ${report.patient.lastName}`;
  const patientGender = report.patient.gender?.trim() || "Not recorded";
  const patientLocation = report.patient.location?.trim() || "Not recorded";
  const patientAge = calculateAge(report.patient.dateOfBirth, report.createdAt);
  const orderedItems =
    report.order.items.map((item) => item.catalogItem.name).join(", ") ||
    report.title;
  const reportDate = formatReportDate(report.createdAt);
  const history = report.medicalHistory?.trim() || "Not provided.";
  const description = report.findings.trim();
  const impression = report.impression.trim();
  const reportedBy = report.signedBy?.trim() || "Pending sign-off";
  const facilityWatermarkSrc = getFacilityWatermarkSrc(facility);
  const standardReportNarrativeHtml =
    history !== "Not provided." || impression
      ? [
          history !== "Not provided."
            ? `<div class="report-label"><strong>History</strong></div><div class="body-copy history-copy">${renderRichText(history)}</div>`
            : "",
          description
            ? `<div class="report-label" style="margin-top:${history !== "Not provided." ? "12px" : "0"}"><strong>Findings</strong></div><div class="body-copy findings-copy">${renderRichText(description)}</div>`
            : "",
          impression
            ? `<div class="report-label" style="margin-top:${history !== "Not provided." || description ? "12px" : "0"}"><strong>Impression</strong></div><div class="body-copy impression-copy">${renderRichText(impression)}</div>`
            : "",
        ].join("")
      : `<div class="body-copy">${renderRichText(description)}</div>`;

  if (isEchoWorksheetReport(report)) {
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.title)} - ${escapeHtml(report.patient.traceCode)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", Arial, sans-serif;
        ${getPrintTypographyCss(facility)}
        color: #111827;
        background: #efefed;
      }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 18px; background: #efefed; }
      .workspace { max-width: 940px; margin: 0 auto; display: grid; gap: 14px; }
      .actions { display: flex; justify-content: flex-end; }
      .print-button { border: 0; border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 700; color: #1f2937; background: #ffffff; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08); cursor: pointer; }
      .echo-sheet { background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
      .echo-header { padding: 16px 20px 10px; border-bottom: 2px solid #16a34a; }
      .letterhead { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: start; }
      .letterhead img { width: 64px; height: 64px; object-fit: contain; }
      .letterhead-copy { display: grid; gap: 2px; }
      .letterhead-copy h1, .letterhead-copy p, .letterhead-copy h2 { margin: 0; }
      .facility-name { font-size: 11pt; font-weight: 700; text-transform: uppercase; }
      .facility-meta { font-size: 13px; line-height: 1.5; }
      .report-title { margin-top: 8px; font-size: 16pt; font-weight: 700; text-transform: uppercase; }
      .patient-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 16px; margin: 12px 20px; padding: 12px; border-radius: 8px; background: #f3f4f6; font-size: 11pt; }
      .echo-paper .echo-print-content { padding: 18px 20px 20px; }
      .echo-section { padding: 16px 20px 18px; border-top: 1px solid #d1d5db; }
      .echo-footer { background: #fff; border: 1px solid #1f2937; padding: 16px 20px 18px; display: grid; gap: 12px; }
      .echo-watermark-wrap { position: relative; }
      .echo-watermark { position: absolute; right: 22px; top: 170px; width: 180px; opacity: 0.05; pointer-events: none; }
      .echo-footer h3 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; }
      .echo-section h3 { color: #15803d; font-size: 10pt; text-transform: uppercase; }
      .echo-footer .body-copy { font-size: 15px; line-height: 1.65; }
      .echo-print-content .body-copy { font-size: 15px; line-height: 1.6; }
      .echo-print-content .body-copy p { margin: 0 0 0.7rem; }
      .echo-print-content .body-copy p:last-child { margin-bottom: 0; }
      .signoff { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; padding-top: 8px; }
      .signoff-block { min-height: 74px; display: flex; flex-direction: column; justify-content: flex-end; }
      .signoff-line { border-top: 1px solid #1f1f1f; padding-top: 6px; font-size: 14px; }
      .signoff-role { margin-top: 4px; font-size: 12px; text-transform: uppercase; color: #4b5563; }
      .facility-note { font-size: 12px; color: #4b5563; text-align: center; }
      @media (max-width: 720px) {
        .signoff { grid-template-columns: 1fr; }
      }
      @media print {
        @page { size: A4 portrait; margin: 15mm; }
        body { padding: 0; background: #fff; }
        .workspace { max-width: none; }
        .print-button { display: none; }
        .echo-sheet, .echo-footer { box-shadow: none; }
        .echo-sheet { border: 0; }
        .echo-section, .echo-footer, .patient-details, tr { break-inside: avoid; page-break-inside: avoid; }
        .page-count::after { content: "Page " counter(page) " of " counter(pages); }
      }
    </style>
  </head>
  <body>
    <div class="workspace">
      <div class="actions">
        <button class="print-button" type="button" onclick="window.print()">Print report</button>
      </div>
      <article class="echo-sheet echo-watermark-wrap">
        ${facilityWatermarkSrc ? `<img class="echo-watermark" src="${facilityWatermarkSrc}" alt="" />` : ""}
        <header class="echo-header">
          <div class="letterhead">
            ${facility.showFacilityProfileOnPrint ? `<img src="${getFacilityLogoSrc(facility)}" alt="Facility logo" />` : ""}
            <div class="letterhead-copy">
              ${facility.showFacilityProfileOnPrint ? `<h1 class="facility-name">${escapeHtml(facility.name)}</h1>${facility.location ? `<p class="facility-meta">${escapeHtml(facility.location)}</p>` : ""}${facility.phone || facility.email ? `<p class="facility-meta">${escapeHtml([facility.phone, facility.email].filter(Boolean).join(" / "))}</p>` : ""}` : ""}
              <h2 class="report-title">${escapeHtml(report.title)}</h2>
            </div>
          </div>
        </header>
        <div class="patient-details">
          <div><strong>Name:</strong> ${escapeHtml(patientName)}</div>
          <div><strong>Age / sex:</strong> ${escapeHtml(patientAge)} / ${escapeHtml(patientGender)}</div>
          <div><strong>Date:</strong> ${escapeHtml(reportDate)}</div>
          <div><strong>Trace code:</strong> ${escapeHtml(report.patient.traceCode)}</div>
          <div><strong>Accession:</strong> ${escapeHtml(report.order.accessionNumber)}</div>
        </div>
        <div class="echo-print-content">
          <div class="body-copy">${renderEchoWorksheetMarkup(description)}</div>
        </div>
        ${(history && history !== "Not provided.") || impression || imagePaths.length ? `<section class="echo-section">` : ""}
        ${(history && history !== "Not provided.") ? `<div><h3>Clinical History</h3><div class="body-copy">${renderRichText(history)}</div></div>` : ""}
        ${impression ? `<div style="margin-top:${history && history !== "Not provided." ? "14px" : "0"}"><h3>Conclusion / Impression</h3><div class="body-copy">${renderRichText(impression)}</div></div>` : ""}
        ${imagePaths.length ? `<div style="margin-top:${(history && history !== "Not provided.") || impression ? "14px" : "0"}"><h3>Image References</h3><div class="body-copy">${imagePaths.map((item) => escapeHtml(item)).join("<br />")}</div></div>` : ""}
        ${(history && history !== "Not provided.") || impression || imagePaths.length ? `</section>` : ""}
      </article>
      <section class="echo-footer">
        <div class="signoff">
          <div class="signoff-block">
            <div class="signoff-line">${escapeHtml(reportedBy)}</div>
            <div class="signoff-role">Reported by</div>
          </div>
          <div class="signoff-block">
            <div class="signoff-line">${escapeHtml(reportDate)}</div>
            <div class="signoff-role">Date</div>
          </div>
        </div>
        <div class="facility-note">${escapeHtml(facility.footerMessage || "Preserve the Patient Trace Code on all printed copies.")}</div>
        ${getFacilityContactLine(facility) ? `<div class="facility-note">${escapeHtml(getFacilityContactLine(facility))}</div>` : ""}
        <div class="facility-note page-count"></div>
      </section>
    </div>
  </body>
</html>`;

    return { fileName, html };
  }

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.title)} - ${escapeHtml(report.patient.traceCode)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Georgia, "Times New Roman", serif;
        ${getPrintTypographyCss(facility)}
        color: #1a1a1a;
        background: #f5f5f5;
      }

      * { box-sizing: border-box; }
      @page { size: A4 portrait; margin: 15mm; }
      body { margin: 0; padding: 18px; background: #f5f5f5; }
      .sheet { max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid #d7d7d7; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08); }
      .hero, .meta, .section, .footer { padding: 14px 24px; }
      .hero { border-bottom: 1px solid #d7d7d7; }
      .brand-row { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
      .brand-row img { width: 64px; height: 64px; object-fit: contain; }
      .brand-mark { display: flex; align-items: flex-start; }
      .brand-copy { display: grid; gap: 3px; }
      .brand-main { display: flex; gap: 18px; align-items: flex-start; }
      .brand-actions { display: grid; justify-items: end; gap: 12px; }
      .brand-copy p, .brand-copy h1, .brand-copy h2 { margin: 0; }
      .brand-copy p { font-size: var(--print-copy-size); }
      .brand-copy .facility-name { font-size: 11pt; font-weight: 700; text-transform: uppercase; }
      .brand-copy h1 { font-size: 16pt; text-transform: uppercase; }
      .brand-copy h2 { font-size: var(--print-copy-size); text-transform: uppercase; text-decoration: underline; margin-top: 6px; }
      .print-button { border: 0; border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 700; color: #1f1f1f; background: #f3f4f6; cursor: pointer; }
      .meta { margin: 12px 24px; padding: 12px; border: 0; border-radius: 8px; background: #f3f4f6; }
      .rule { margin-top: 10px; border-top: 2px solid #16a34a; }
      .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 20px; }
      .meta-line { display: grid; grid-template-columns: 110px 1fr; gap: 8px; align-items: baseline; }
      .label { font-size: var(--print-copy-size); font-weight: 700; text-transform: uppercase; }
      .value { font-size: var(--print-body-size); }
      .section { border-bottom: 1px solid #ececec; font-size: var(--print-body-size); }
      .section h3, .report-label { margin: 0 0 8px; color: #15803d; font-size: 10pt; font-weight: 700; text-transform: uppercase; }
      .body-copy { line-height: 1.5; white-space: normal; font-size: 11pt; }
      .impression-copy { margin-top: 4px; padding: 10px 12px; border-left: 3px solid #16a34a; background: #f0fdf4; }
      .body-copy h1, .body-copy h2, .body-copy h3 { margin: 0 0 0.75rem; line-height: 1.2; }
      .body-copy h1 { font-size: 1.8rem; }
      .body-copy h2 { font-size: 1.45rem; }
      .body-copy h3 { font-size: 1.2rem; }
      .body-copy p { margin: 0 0 0.8rem; }
      .body-copy p:last-child { margin-bottom: 0; }
      .body-copy ul, .body-copy ol { margin: 0.5rem 0 0.8rem 1.2rem; }
      .body-copy mark { padding: 0.05rem 0.18rem; border-radius: 4px; }
      .body-copy img { display: block; max-width: 100%; height: auto; margin: 0.85rem auto; border-radius: 10px; }
      .body-copy table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
      .body-copy th, .body-copy td { border: 1px solid #cbd5e1; padding: 8px 10px; vertical-align: top; }
      .body-copy th { background: #eff6ff; text-align: left; }
      .body-copy .editor-page-break { margin: 1.2rem 0; border-top: 2px dashed #94a3b8; }
      .body-copy .editor-page-break::before { content: "Page break"; display: inline-block; margin-top: -0.7rem; padding: 0.12rem 0.5rem; background: #fff; color: #475569; font-size: 11px; font-weight: 700; }
      .signoff { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; padding: 22px 24px 16px; }
      .signoff-block { min-height: 74px; display: flex; flex-direction: column; justify-content: flex-end; }
      .signoff-line { border-top: 1px solid #1f1f1f; padding-top: 6px; font-size: 14px; }
      .signoff-role { margin-top: 4px; font-size: 12px; text-transform: uppercase; color: #4b5563; }
      .footer { display: grid; gap: 6px; text-align: center; font-size: 13px; }
      .developer-credit { color: #6b7280; font-size: 12px; }
      .watermark { position: absolute; right: 32px; top: 220px; width: 180px; opacity: 0.05; pointer-events: none; }
      .sheet-wrap { position: relative; }
      table, tr, .meta-line, .signoff-block { break-inside: avoid; page-break-inside: avoid; }
      @media (max-width: 720px) {
        .brand-row, .brand-main { flex-direction: column; }
        .brand-actions { justify-items: start; }
        .meta-grid, .signoff { grid-template-columns: 1fr; }
      }
      @media print {
        body { background: white; padding: 0; }
        .sheet { width: 100%; max-width: none; min-height: 267mm; box-shadow: none; border: none; }
        .hero, .meta, .section, .footer { padding-left: 0; padding-right: 0; }
        .meta { padding: 12px; }
        .print-button { display: none; }
        .page-count::after { content: "Page " counter(page) " of " counter(pages); }
        .body-copy .editor-page-break { break-before: page; page-break-before: always; border: 0; margin: 0; }
        .body-copy .editor-page-break::before { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="sheet-wrap">
    ${facilityWatermarkSrc ? `<img class="watermark" src="${facilityWatermarkSrc}" alt="" />` : ""}
    <article class="sheet">
      <header class="hero">
        <div class="brand-row">
          <div class="brand-main">
            <div class="brand-mark">
              ${facility.showFacilityProfileOnPrint ? `<img src="${getFacilityLogoSrc(facility)}" alt="Facility logo" />` : ""}
            </div>
            <div class="brand-copy">
              ${facility.showFacilityProfileOnPrint ? `<p class="facility-name">${escapeHtml(facility.name)}</p>${facility.location ? `<p>${escapeHtml(facility.location)}</p>` : ""}${facility.phone || facility.email ? `<p>${escapeHtml([facility.phone, facility.email].filter(Boolean).join(" / "))}</p>` : ""}` : ""}
              <h1>${escapeHtml(report.title)}</h1>
              <h2>${escapeHtml(orderedItems)}</h2>
              <div class="rule"></div>
            </div>
          </div>
          <div class="brand-actions">
            <button class="print-button" type="button" onclick="window.print()">Print report</button>
          </div>
        </div>
      </header>
      <section class="meta">
        <div class="meta-grid">
          <div class="meta-line"><div class="label">Name:</div><div class="value">${escapeHtml(patientName)}</div></div>
          <div class="meta-line"><div class="label">Age:</div><div class="value">${escapeHtml(patientAge)}</div></div>
          <div class="meta-line"><div class="label">Date:</div><div class="value">${escapeHtml(reportDate)}</div></div>
          <div class="meta-line"><div class="label">Gender:</div><div class="value">${escapeHtml(patientGender)}</div></div>
          <div class="meta-line"><div class="label">Location:</div><div class="value">${escapeHtml(patientLocation)}</div></div>
          <div class="meta-line"><div class="label">Trace Code:</div><div class="value">${escapeHtml(report.patient.traceCode)}</div></div>
          <div class="meta-line"><div class="label">Accession:</div><div class="value">${escapeHtml(report.order.accessionNumber)}</div></div>
        </div>
      </section>
      <section class="section"><h3>Report</h3>${standardReportNarrativeHtml}</section>
      ${imagePaths.length ? `<section class="section"><h3>Image References</h3><div class="body-copy">${imagePaths.map((item) => escapeHtml(item)).join("<br />")}</div></section>` : ""}
      <section class="signoff">
        <div class="signoff-block">
          <div class="signoff-line">${escapeHtml(reportedBy)}</div>
          <div class="signoff-role">Reported by</div>
        </div>
        <div class="signoff-block">
          <div class="signoff-line">${escapeHtml(reportDate)}</div>
          <div class="signoff-role">Date</div>
        </div>
      </section>
      <footer class="footer">
        <div>${escapeHtml(facility.footerMessage || "Preserve the Patient Trace Code on all printed copies.")}</div>
        ${getFacilityContactLine(facility) ? `<div>${escapeHtml(getFacilityContactLine(facility))}</div>` : ""}
        <div class="page-count"></div>
        <div class="developer-credit">${escapeHtml(getDeveloperCreditLine())}</div>
      </footer>
    </article>
    </div>
  </body>
</html>`;

  return {
    reportId: report.id,
    fileName,
    html,
    pdfReady: Boolean(report.pdfPath),
  };
}

async function buildReceiptBundle(prisma: PrismaClient, paymentId: string) {
  const payment = await prisma.paymentRecord.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      invoice: {
        include: {
          patient: true,
          lines: true,
          order: {
            include: {
              items: {
                include: {
                  catalogItem: true,
                },
              },
            },
          },
        },
      },
    },
  });
  const facility = await resolveFacilityProfile(
    prisma,
    payment.invoice.patient.facilityId,
  );

  return {
    facility,
    payment,
    patientName: `${payment.invoice.patient.firstName} ${payment.invoice.patient.lastName}`,
    orderedItems:
      payment.invoice.lines.map((line) => line.description).join(", ") ||
      payment.invoice.order.items.map((item) => item.catalogItem.name).join(", ") ||
      "Diagnostic services",
    serviceLines: payment.invoice.lines.map((line) => ({
      name: line.description,
      amountCents: line.totalPriceCents,
    })),
    balanceCents: Math.max(
      0,
      payment.invoice.amountDueCents - payment.invoice.amountPaidCents,
    ),
    fileName: `${payment.invoice.patient.traceCode}-receipt-${payment.id.slice(-6)}.html`,
  };
}

async function buildInvoiceBundle(prisma: PrismaClient, invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      patient: true,
      order: {
        include: {
          items: {
            include: {
              catalogItem: true,
            },
          },
        },
      },
      payments: true,
    },
  });
  const facility = await resolveFacilityProfile(prisma, invoice.patient.facilityId);

  return {
    facility,
    invoice,
    patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
    orderedItems: invoice.order.items.map((item) => ({
      id: item.id,
      name: item.catalogItem.name,
      priceCents: item.catalogItem.priceCents,
    })),
    balanceCents: Math.max(0, invoice.amountDueCents - invoice.amountPaidCents),
    fileName: `${invoice.patient.traceCode}-invoice-${invoice.id.slice(-6)}.html`,
  };
}

export async function renderPrintableReportHtml(
  prisma: PrismaClient,
  reportId: string,
) {
  return composePrintableReportHtml(await buildReportBundle(prisma, reportId));
}

export async function renderDraftPrintableReportHtml(
  prisma: PrismaClient,
  payload: ReportInput,
) {
  return composePrintableReportHtml(await buildDraftReportBundle(prisma, payload));
}

export async function ensureReportPdf(prisma: PrismaClient, reportId: string) {
  const bundle = await buildReportBundle(prisma, reportId);

  if (bundle.report.pdfPath) {
    try {
      await access(bundle.report.pdfPath);
      return bundle.report.pdfPath;
    } catch {
      // Regenerate if the file reference exists but the artifact is missing.
    }
  }

  await mkdir(reportsDir, { recursive: true });
  const doc = new PDFDocument({ margin: 42, size: "A4" });
  const stream = createWriteStream(bundle.filePath);
  const patientName = `${bundle.report.patient.firstName} ${bundle.report.patient.lastName}`;
  const orderedItems =
    bundle.report.order.items.map((item) => item.catalogItem.name).join(", ") ||
    bundle.report.title;
  const patientGender = bundle.report.patient.gender?.trim() || "Not recorded";
  const patientLocation =
    bundle.report.patient.location?.trim() || "Not recorded";
  const patientAge = calculateAge(
    bundle.report.patient.dateOfBirth,
    bundle.report.createdAt,
  );
  const reportDate = formatReportDate(bundle.report.createdAt);
  const reportedBy = bundle.report.signedBy?.trim() || "Pending sign-off";
  const narrativeLines = [
    bundle.report.medicalHistory?.trim() &&
    bundle.report.medicalHistory.trim() !== "Not provided."
      ? `History\n${bundle.report.medicalHistory.trim()}`
      : "",
    bundle.report.findings.trim()
      ? narrativeIsHtml(bundle.report.findings)
        ? htmlToText(bundle.report.findings)
        : bundle.report.findings.trim()
      : "",
    bundle.report.impression.trim()
      ? `Impression\n${bundle.report.impression.trim()}`
      : "",
  ].filter(Boolean);
  const sections = [["Report", narrativeLines.join("\n\n")]].filter(
    ([, value]) => Boolean(value),
  ) as Array<[string, string]>;

  await new Promise<void>((resolve, reject) => {
    doc.pipe(stream);
    if (bundle.facility.showFacilityProfileOnPrint) {
      drawPdfBrand(doc, bundle.facility);
      doc.fontSize(11).fillColor("#5d6d67").text(bundle.facility.code, 96, 36);
      doc.fontSize(13).fillColor("#14231f").text(bundle.facility.name);
    if (bundle.facility.location) {
      doc
        .moveDown(0.15)
        .fontSize(9)
        .fillColor("#5d6d67")
        .text(bundle.facility.location);
    }
    if (bundle.facility.phone || bundle.facility.email) {
      doc
        .moveDown(0.15)
        .fontSize(9)
        .fillColor("#5d6d67")
        .text(
          [bundle.facility.phone, bundle.facility.email]
            .filter(Boolean)
            .join(" / "),
        );
    }
    }
    doc.moveDown(0.45);
    doc
      .fontSize(20)
      .fillColor("#14231f")
      .text(bundle.report.title, { align: "center" });
    doc.moveDown(0.15);
    doc
      .fontSize(12)
      .fillColor("#0d5f58")
      .text(orderedItems, { align: "center", underline: true });
    doc.moveDown(1);

    doc
      .fontSize(11)
      .fillColor("#0d5f58")
      .text("Patient Details", { underline: true });
    doc.moveDown(0.35);
    doc.fillColor("#14231f").text(`Name: ${patientName}`);
    doc.text(`Age: ${patientAge}`);
    doc.text(`Date: ${reportDate}`);
    doc.text(`Gender: ${patientGender}`);
    doc.text(`Location: ${patientLocation}`);
    doc.text(`Trace Code: ${bundle.report.patient.traceCode}`);
    doc.text(`Accession: ${bundle.report.order.accessionNumber}`);
    doc.moveDown(0.8);

    for (const [heading, value] of sections) {
      doc.fontSize(11).fillColor("#0d5f58").text(heading, { underline: true });
      doc.moveDown(0.25);
      doc.fontSize(11).fillColor("#14231f").text(value, { lineGap: 3 });
      doc.moveDown(0.8);
    }

    doc
      .fontSize(11)
      .fillColor("#0d5f58")
      .text("Image References", { underline: true });
    doc.moveDown(0.25);
    if (bundle.imagePaths.length === 0) {
      doc
        .fontSize(11)
        .fillColor("#14231f")
        .text("No image references attached.");
    } else {
      for (const imagePath of bundle.imagePaths) {
        doc.fontSize(11).fillColor("#14231f").text(`- ${imagePath}`);
      }
    }

    const signoffTop = doc.y + 18;
    doc
      .moveTo(42, signoffTop)
      .lineTo(245, signoffTop)
      .lineWidth(1)
      .strokeColor("#1f1f1f")
      .stroke();
    doc
      .moveTo(320, signoffTop)
      .lineTo(520, signoffTop)
      .lineWidth(1)
      .strokeColor("#1f1f1f")
      .stroke();
    doc
      .fontSize(10)
      .fillColor("#14231f")
      .text(reportedBy, 42, signoffTop + 6, { width: 203, align: "center" });
    doc
      .fontSize(8)
      .fillColor("#5d6d67")
      .text("Reported by", 42, signoffTop + 22, {
        width: 203,
        align: "center",
      });
    doc
      .fontSize(10)
      .fillColor("#14231f")
      .text(reportDate, 320, signoffTop + 6, { width: 200, align: "center" });
    doc
      .fontSize(8)
      .fillColor("#5d6d67")
      .text("Date", 320, signoffTop + 22, { width: 200, align: "center" });
    doc.y = signoffTop + 48;

    doc.moveDown(1.2);
    doc
      .fillOpacity(0.08)
      .fontSize(54)
      .fillColor("#0F6BFF")
      .text("MediLab Nexus", 120, 320, { width: 380, align: "center" });
    doc.fillOpacity(1);
    doc
      .fontSize(9)
      .fillColor("#5d6d67")
      .text(
        bundle.facility.footerMessage ||
          "Preserve the Patient Trace Code on all printed copies.",
        {
          align: "center",
        },
      );
    if (getFacilityContactLine(bundle.facility)) {
      doc
        .moveDown(0.25)
        .fontSize(9)
        .fillColor("#5d6d67")
        .text(getFacilityContactLine(bundle.facility), { align: "center" });
    }
    doc
      .moveDown(0.25)
      .fontSize(8)
      .fillColor("#7b8794")
      .text(getDeveloperCreditLine(), {
        align: "center",
      });
    doc.end();

    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
  });

  await prisma.report.update({
    where: { id: reportId },
    data: { pdfPath: bundle.filePath },
  });
  return bundle.filePath;
}

export async function readReportPdf(prisma: PrismaClient, reportId: string) {
  const pdfPath = await ensureReportPdf(prisma, reportId);
  return readFile(pdfPath);
}

export async function renderPrintableReceiptHtml(
  prisma: PrismaClient,
  paymentId: string,
) {
  const bundle = await buildReceiptBundle(prisma, paymentId);
  const {
    facility,
    payment,
    patientName,
    orderedItems,
    serviceLines,
    balanceCents,
    fileName,
  } = bundle;
  const patientGender =
    payment.invoice.patient.gender?.trim() || "Not recorded";
  const receiptDate = payment.createdAt.toLocaleDateString();
  const receiptTimestamp = payment.createdAt.toLocaleString();
  const money = (amountCents: number) => `GHc ${(amountCents / 100).toFixed(2)}`;
  const paidAmount = money(payment.amountCents);
  const numberWords = (value: number): string => {
    const small = [
      "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
      "Seventeen", "Eighteen", "Nineteen",
    ];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    if (value < 20) return small[value] ?? "Zero";
    if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${small[value % 10]}` : ""}`;
    if (value < 1000) return `${small[Math.floor(value / 100)]} Hundred${value % 100 ? ` and ${numberWords(value % 100)}` : ""}`;
    for (const [scale, label] of [[1_000_000_000, "Billion"], [1_000_000, "Million"], [1_000, "Thousand"]] as const) {
      if (value >= scale) {
        const remainder = value % scale;
        return `${numberWords(Math.floor(value / scale))} ${label}${remainder ? ` ${numberWords(remainder)}` : ""}`;
      }
    }
    return "Zero";
  };
  const wholeCedis = Math.floor(payment.amountCents / 100);
  const pesewas = payment.amountCents % 100;
  const amountInWords = `${numberWords(wholeCedis)} Ghana Cedis${pesewas ? ` and ${numberWords(pesewas)} Pesewas` : ""}`;
  const serviceItems = orderedItems.split(",").map((item) => item.trim()).filter(Boolean);
  const visibleServices = serviceItems.slice(0, 3);
  const servicesLabel = `${visibleServices.join(", ") || "Diagnostic services"}${serviceItems.length > 3 ? ` +${serviceItems.length - 3} more` : ""}`;
  const receiptNumber = payment.id.slice(-8).toUpperCase();
  const receiptTitle = escapeHtml(facility.name || "MediLab Nexus");
  const facilityContact = getFacilityContactLine(facility);
  const paymentMethod = formatStatusLabel(payment.method);
  const { traceCode } = payment.invoice.patient;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Receipt ${escapeHtml(traceCode)}</title>
    <style>
      * { box-sizing: border-box; }
      :root { color-scheme: light; font-family: Georgia, "Times New Roman", serif; color: #111; background: #f3f4f6; }
      body { margin: 0; padding: 18px; }
      .toolbar { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 auto 14px; font: 14px Inter, system-ui, sans-serif; }
      .toolbar button { min-height: 38px; padding: 0 14px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; color: #111827; cursor: pointer; }
      .toolbar button.primary { border-color: #16a34a; background: #16a34a; color: #fff; }
      .a4-sheet { width: 210mm; height: 297mm; margin: 0 auto; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.12); overflow: hidden; }
      .receipt { position: relative; width: 210mm; height: 99mm; box-sizing: border-box; padding: 6mm; overflow: hidden; page-break-inside: avoid; border: 1px solid #111; }
      .receipt-header { display: grid; grid-template-columns: 14mm minmax(0,1fr) auto; align-items: center; gap: 3mm; min-height: 14mm; padding-bottom: 2mm; border-bottom: 2px solid #16a34a; }
      .receipt-logo { width: 14mm; height: 14mm; max-height: 14mm; object-fit: contain; }
      .facility-name { margin: 0; font-size: 11pt; line-height: 1.1; font-weight: 700; text-align: center; }
      .facility-contact { margin: 1mm 0 0; font: 8pt Inter, system-ui, sans-serif; text-align: center; }
      .receipt-title { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 4mm; margin-top: 1mm; font-size: 12pt; font-weight: 700; }
      .receipt-number { font-size: 10pt; white-space: nowrap; }
      .receipt-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; padding-top: 1mm; font-size: 9.5pt; line-height: 1.1; }
      .receipt-row { display: grid; grid-template-columns: max-content minmax(0,1fr); gap: 2mm; align-items: baseline; min-height: 6.4mm; padding: 1.2mm 0; border-bottom: 1px solid #111; }
      .receipt-row strong { font-weight: 700; }
      .receipt-row .value { min-width: 0; font-weight: 400; overflow-wrap: anywhere; }
      .receipt-row .value.emphasis { font-weight: 700; }
      .amount-words { min-height: 8mm; font-weight: 700; }
      .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 1mm; font-size: 9pt; }
      .signature-line { padding-top: 2mm; border-bottom: 1px solid #111; }
      .receipt-footer { display: flex; justify-content: space-between; gap: 3mm; margin-top: 2mm; font: 8pt Inter, system-ui, sans-serif; }
      .cut-line { position: absolute; right: 6mm; bottom: 0; left: 6mm; padding-top: 1mm; border-top: 1px dashed #9ca3af; color: #6b7280; font: 7pt Inter, system-ui, sans-serif; text-align: center; }
      .cut-toggle { color: #374151; font-size: 12px; }
      body[data-cut-line="off"] .cut-line { display: none; }
      .thermal-content { display: none; }
      @page { size: A4 portrait; margin: 0; }
      @page thermal { size: 80mm auto; margin: 0; }
      @media print {
        body { padding: 0; background: #fff; }
        .toolbar { display: none; }
        .a4-sheet { margin: 0; box-shadow: none; }
        body[data-print-mode="thermal"] .a4-sheet { page: thermal; width: 80mm; height: auto; }
        body[data-print-mode="thermal"] .receipt { display: none; }
        body[data-print-mode="thermal"] .thermal-content { display: block; width: 80mm; padding: 4mm; font: 10pt "Courier New", monospace; }
        body[data-print-mode="thermal"] .thermal-header { text-align: center; font-weight: 700; }
        body[data-print-mode="thermal"] .thermal-rule { margin: 2mm 0; border-top: 1px dashed #111; }
        body[data-print-mode="thermal"] .thermal-line { display: flex; justify-content: space-between; gap: 2mm; }
        body[data-print-mode="thermal"] .thermal-total { font-weight: 700; }
      }
    </style>
  </head>
  <body data-print-mode="a4" data-cut-line="on">
    <div class="toolbar">
      <button class="primary" type="button" onclick="document.body.dataset.printMode='a4'; window.print()">Print A4 receipt</button>
      <button type="button" onclick="document.body.dataset.printMode='thermal'; window.print()">Print thermal</button>
      <label class="cut-toggle"><input type="checkbox" checked onchange="document.body.dataset.cutLine=this.checked?'on':'off'" /> Cut line</label>
    </div>
    <main class="a4-sheet">
      <article class="receipt">
        <header class="receipt-header">
          ${facility.showFacilityProfileOnPrint ? `<img class="receipt-logo" src="${getFacilityLogoSrc(facility)}" alt="Facility logo" />` : "<span></span>"}
          <div>
            <h1 class="facility-name">${receiptTitle}</h1>
            ${facility.showFacilityProfileOnPrint && facilityContact ? `<p class="facility-contact">${escapeHtml(facilityContact)}</p>` : ""}
          </div>
          <span></span>
          <div class="receipt-title"><span>PAYMENT RECEIPT</span><span class="receipt-number">No: ${escapeHtml(receiptNumber)}</span></div>
        </header>
        <div class="receipt-columns">
          <div>
            <div class="receipt-row"><strong>Patient</strong><span class="value">${escapeHtml(patientName)} · ${escapeHtml(patientGender)}</span></div>
            <div class="receipt-row"><strong>Payment for</strong><span class="value">Diagnostic services</span></div>
            <div class="receipt-row"><strong>Trace Code</strong><span class="value emphasis">${escapeHtml(traceCode)}</span></div>
            <div class="receipt-row"><strong>Services</strong><span class="value">${escapeHtml(servicesLabel)}</span></div>
            <div class="receipt-row amount-words"><strong>In words</strong><span class="value">${escapeHtml(amountInWords)}</span></div>
            <div class="receipt-row"><strong>Paid by</strong><span class="value">${escapeHtml(patientName)}</span></div>
          </div>
          <div>
            <div class="receipt-row"><strong>Date and time</strong><span class="value">${escapeHtml(receiptTimestamp)}</span></div>
            <div class="receipt-row"><strong>Amount to pay</strong><span class="value">${escapeHtml(money(payment.invoice.amountDueCents))}</span></div>
            <div class="receipt-row"><strong>Insurance cover</strong><span class="value">${escapeHtml(money(payment.invoice.insuranceCoveredCents))}</span></div>
            <div class="receipt-row"><strong>Amount paid</strong><span class="value emphasis">${escapeHtml(paidAmount)}</span></div>
            <div class="receipt-row"><strong>Pay mode</strong><span class="value">${escapeHtml(paymentMethod)}</span></div>
            <div class="receipt-row"><strong>Balance</strong><span class="value emphasis">${escapeHtml(money(balanceCents))}</span></div>
            <div class="receipt-row"><strong>Cashier</strong><span class="value">${escapeHtml(payment.receivedBy)}</span></div>
          </div>
        </div>
        <div class="signature-row"><span>Signature: <span class="signature-line"></span></span><span>Receipt date: ${escapeHtml(receiptDate)}</span></div>
        <footer class="receipt-footer">
          <span>Collect results with trace code ${escapeHtml(traceCode)}</span>
          <span>Developed by OmniWeave Softwares</span>
        </footer>
        <div class="cut-line">- - - - - - - - - - - - - - - - - - - - - - - cut here - - - - - - - - - - - - - - - - - - - -</div>
      </article>
      <section class="thermal-content">
        <div class="thermal-header">${receiptTitle}<br />${escapeHtml(facilityContact)}</div>
        <div class="thermal-rule"></div>
        <div>PAYMENT RECEIPT ${escapeHtml(receiptNumber)}</div>
        <div>${escapeHtml(receiptTimestamp)}</div>
        <div>Patient: ${escapeHtml(patientName)}</div>
        <div>Cashier: ${escapeHtml(payment.receivedBy)}</div>
        <div class="thermal-rule"></div>
        ${(serviceLines.length ? serviceLines.slice(0, 3) : visibleServices.map((name) => ({ name, amountCents: 0 }))).map((item) => `<div class="thermal-line"><span>${escapeHtml(item.name)}</span><span>${item.amountCents ? escapeHtml(money(item.amountCents)) : ""}</span></div>`).join("")}
        ${serviceItems.length > 3 ? `<div>+${serviceItems.length - 3} more</div>` : ""}
        <div class="thermal-rule"></div>
        <div class="thermal-line"><span>Subtotal</span><span>${escapeHtml(money(payment.invoice.subtotalCents))}</span></div>
        <div class="thermal-line"><span>Insurance</span><span>${escapeHtml(money(payment.invoice.insuranceCoveredCents))}</span></div>
        <div class="thermal-line thermal-total"><span>TOTAL</span><span>${escapeHtml(money(payment.invoice.amountDueCents))}</span></div>
        <div class="thermal-line"><span>Paid (${escapeHtml(paymentMethod)})</span><span>${escapeHtml(paidAmount)}</span></div>
        <div class="thermal-line"><span>Balance</span><span>${escapeHtml(money(balanceCents))}</span></div>
        <div class="thermal-rule"></div>
        <div>Trace code: ${escapeHtml(traceCode)}</div>
      </section>
    </main>
  </body>
</html>`;

  return {
    paymentId: payment.id,
    fileName,
    html,
  };
}

export async function renderPrintableInvoiceHtml(
  prisma: PrismaClient,
  invoiceId: string,
) {
  const bundle = await buildInvoiceBundle(prisma, invoiceId);
  const {
    facility,
    invoice,
    patientName,
    orderedItems,
    balanceCents,
    fileName,
  } = bundle;
  const paymentSummary = invoice.payments.length
    ? `${invoice.payments.length} payment(s) received`
    : "No payments received yet";
  const payerLabel =
    invoice.payerName?.trim() ||
    (invoice.payerType === "SELF_PAY" ? "Self Pay" : formatStatusLabel(invoice.payerType));
  const memberId = invoice.payerMemberId?.trim() || "Not recorded";
  const authorizationCode =
    invoice.payerAuthorizationCode?.trim() || "Not recorded";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice ${escapeHtml(invoice.patient.traceCode)}</title>
    <style>
      :root { color-scheme: light; font-family: Inter, system-ui, sans-serif; ${getPrintTypographyCss(facility)} color: #111827; background: #f8fafc; }
      * { box-sizing: border-box; }
      @page { size: A5 portrait; margin: 12mm; }
      body { margin: 0; padding: 24px; background: #f8fafc; }
      .sheet { max-width: 840px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
      .hero { display: flex; justify-content: space-between; gap: 18px; align-items: center; padding: 24px; background: #16a34a; color: #ffffff; }
      .hero img { width: 74px; height: 74px; object-fit: contain; border-radius: 18px; background: rgba(255,255,255,0.12); padding: 8px; }
      .hero-side { display: grid; justify-items: end; gap: 12px; }
      .hero h1, .hero p { margin: 0; }
      .hero h1 { margin-top: 8px; font-size: var(--print-title-size); }
      .contact { margin-top: 8px; opacity: 0.92; font-size: var(--print-copy-size); }
      .print-button { border: 0; border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 700; color: #0f3f75; background: #ffffff; cursor: pointer; }
      .section { padding: 22px 32px; border-top: 1px solid rgba(15, 42, 78, 0.08); }
      .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .meta-card, .summary-card, .line-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #fff; }
      .label { font-size: calc(var(--print-copy-size) - 2px); text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; }
      .value { margin-top: 6px; font-size: var(--print-metric-size); font-weight: 700; color: #10233d; }
      .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
      .line-items { display: grid; gap: 12px; }
      .line-item { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
      .line-item small { color: #64748b; }
      .footer { padding: 22px 32px; color: #6b7280; background: #fff; font-size: var(--print-copy-size); display: grid; gap: 6px; }
      .developer-credit { color: #6b7280; font-size: 12px; }
      @media print { body { padding: 0; background: #fff; } .sheet { width: 100%; max-width: none; min-height: 186mm; border: 0; border-radius: 0; box-shadow: none; } .print-button { display: none; } }
    </style>
  </head>
  <body>
    <article class="sheet">
      <header class="hero">
        <div>
          ${facility.showFacilityProfileOnPrint ? `<p>${escapeHtml(facility.name)}</p><p class="contact">${escapeHtml(getFacilityContactLine(facility) || facility.code)}</p>` : ""}
          <h1>Invoice Statement</h1>
        </div>
        <div class="hero-side">
          <button class="print-button" type="button" onclick="window.print()">Print invoice</button>
          ${facility.showFacilityProfileOnPrint ? `<img src="${getFacilityLogoSrc(facility)}" alt="Facility logo" />` : ""}
        </div>
      </header>
      <section class="section">
        <div class="meta-grid">
          <div class="meta-card"><div class="label">Patient</div><div class="value">${escapeHtml(patientName)}</div></div>
          <div class="meta-card"><div class="label">Trace Code</div><div class="value">${escapeHtml(invoice.patient.traceCode)}</div></div>
          <div class="meta-card"><div class="label">Accession</div><div class="value">${escapeHtml(invoice.order.accessionNumber)}</div></div>
          <div class="meta-card"><div class="label">Invoice Status</div><div class="value">${escapeHtml(invoice.status)}</div></div>
        </div>
      </section>
      <section class="section">
        <div class="line-items">
          ${orderedItems
            .map(
              (item) =>
                `<div class="line-item"><div><strong>${escapeHtml(item.name)}</strong><br /><small>Diagnostic service item</small></div><strong>GHc ${(item.priceCents / 100).toFixed(2)}</strong></div>`,
            )
            .join("")}
        </div>
      </section>
      <section class="section">
        <div class="summary-grid">
          <div class="summary-card"><div class="label">Subtotal</div><div class="value">GHc ${(invoice.subtotalCents / 100).toFixed(2)}</div></div>
          <div class="summary-card"><div class="label">Discount</div><div class="value">GHc ${(invoice.discountCents / 100).toFixed(2)}</div></div>
          <div class="summary-card"><div class="label">Paid</div><div class="value">GHc ${(invoice.amountPaidCents / 100).toFixed(2)}</div></div>
          <div class="summary-card"><div class="label">Balance</div><div class="value">GHc ${(balanceCents / 100).toFixed(2)}</div></div>
        </div>
      </section>
      <section class="section">
        <div class="meta-grid">
          <div class="meta-card"><div class="label">Payer</div><div class="value">${escapeHtml(payerLabel)}</div></div>
          <div class="meta-card"><div class="label">Claim Status</div><div class="value">${escapeHtml(formatStatusLabel(invoice.claimStatus))}</div></div>
          <div class="meta-card"><div class="label">Coverage</div><div class="value">${invoice.payerCoveragePercent}% · GHc ${(invoice.payerResponsibilityCents / 100).toFixed(2)}</div></div>
          <div class="meta-card"><div class="label">Patient Due</div><div class="value">GHc ${(invoice.patientResponsibilityCents / 100).toFixed(2)}</div></div>
          <div class="meta-card"><div class="label">Member ID</div><div class="value">${escapeHtml(memberId)}</div></div>
          <div class="meta-card"><div class="label">Authorization</div><div class="value">${escapeHtml(authorizationCode)}</div></div>
          <div class="meta-card"><div class="label">Collected</div><div class="value">${escapeHtml(paymentSummary)}</div></div>
          <div class="meta-card"><div class="label">Issued</div><div class="value">${escapeHtml(invoice.createdAt.toLocaleString())}</div></div>
          <div class="meta-card"><div class="label">Amount Due</div><div class="value">GHc ${(invoice.amountDueCents / 100).toFixed(2)}</div></div>
        </div>
      </section>
      <footer class="footer">
        <div>${escapeHtml(facility.footerMessage)} ${escapeHtml(facility.code)}${facility.location ? ` · ${escapeHtml(facility.location)}` : ""}</div>
        <div class="developer-credit">${escapeHtml(getDeveloperCreditLine())}</div>
      </footer>
    </article>
  </body>
</html>`;

  return {
    invoiceId: invoice.id,
    fileName,
    html,
  };
}

export async function renderPrintableFinanceAnalyticsHtml(
  prisma: PrismaClient,
  actor: { facilityId: string },
  analytics: FinanceAnalyticsPayload,
) {
  const facility = await resolveFacilityProfile(prisma, actor.facilityId);
  const rangeLabel =
    analytics.range === "TODAY"
      ? "Today"
      : analytics.range === "YESTERDAY"
        ? "Yesterday"
        : analytics.range === "7D"
          ? "Last 7 days"
          : analytics.range === "30D"
            ? "Last 30 days"
            : analytics.range === "CUSTOM"
              ? `${analytics.customStartDate ? new Date(analytics.customStartDate).toLocaleDateString() : "Start"} to ${analytics.customEndDate ? new Date(analytics.customEndDate).toLocaleDateString() : "End"}`
              : "All time";
  const fileName = `operations-report-${sanitizeFilePart(rangeLabel)}.html`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Financial Overview - ${escapeHtml(facility.name)}</title>
    <style>
      :root { color-scheme: light; font-family: Inter, system-ui, sans-serif; ${getPrintTypographyCss(facility)} color: #111827; background: #f8fafc; }
      * { box-sizing: border-box; }
      @page { size: A4 portrait; margin: 15mm; }
      body { margin: 0; padding: 24px; background: #f8fafc; }
      .sheet { max-width: 980px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
      .hero { display: flex; justify-content: space-between; gap: 18px; align-items: center; padding: 24px; background: #16a34a; color: #ffffff; }
      .hero img { width: 74px; height: 74px; object-fit: contain; border-radius: 18px; background: rgba(255,255,255,0.12); padding: 8px; }
      .hero-side { display: grid; justify-items: end; gap: 12px; }
      .hero h1, .hero p { margin: 0; }
      .hero h1 { margin-top: 8px; font-size: var(--print-title-size); }
      .contact { margin-top: 8px; opacity: 0.92; font-size: var(--print-copy-size); }
      .print-button { border: 0; border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 700; color: #0f3f75; background: #ffffff; cursor: pointer; }
      .section { padding: 22px 32px; border-top: 1px solid rgba(15, 42, 78, 0.08); }
      .section-title { margin: 0 0 14px; font-size: var(--print-section-title-size); color: #10233d; }
      .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
      .metric-card, .row-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #ffffff; }
      .row-list { display: grid; gap: 12px; }
      .row-card { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
      .label { font-size: calc(var(--print-copy-size) - 2px); text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; }
      .value { margin-top: 6px; font-size: var(--print-metric-size); font-weight: 700; color: #10233d; }
      .footer { padding: 22px 32px; color: #5b6d82; background: #f8fbff; font-size: var(--print-copy-size); display: grid; gap: 6px; }
      .developer-credit { color: #6b7280; font-size: 12px; }
      @media print { body { padding: 0; background: #fff; } .sheet { width: 100%; max-width: none; min-height: 267mm; border: 0; border-radius: 0; box-shadow: none; } .section { padding-left: 0; padding-right: 0; } .print-button { display: none; } .row-card, .metric-card { break-inside: avoid; page-break-inside: avoid; } }
    </style>
  </head>
  <body>
    <article class="sheet">
      <header class="hero">
        <div>
          ${facility.showFacilityProfileOnPrint ? `<p>${escapeHtml(facility.name)}</p>` : ""}
          <h1>Financial Overview</h1>
          <p class="contact">${escapeHtml(rangeLabel)} · Generated ${escapeHtml(new Date(analytics.generatedAt).toLocaleString())}</p>
        </div>
        <div class="hero-side">
          <button class="print-button" type="button" onclick="window.print()">Print overview</button>
          ${facility.showFacilityProfileOnPrint ? `<img src="${getFacilityLogoSrc(facility)}" alt="Facility logo" />` : ""}
        </div>
      </header>
      <section class="section">
        <div class="metric-grid">
          <div class="metric-card"><div class="label">Revenue</div><div class="value">GHc ${(analytics.summary.grossBilledCents / 100).toFixed(2)}</div></div>
          <div class="metric-card"><div class="label">Profit</div><div class="value">GHc ${(analytics.summary.netProfitCents / 100).toFixed(2)}</div></div>
          <div class="metric-card"><div class="label">Expenses</div><div class="value">GHc ${(analytics.summary.expenseCents / 100).toFixed(2)}</div></div>
          <div class="metric-card"><div class="label">Collected</div><div class="value">GHc ${(analytics.summary.collectedCents / 100).toFixed(2)}</div></div>
          <div class="metric-card"><div class="label">Payer cover</div><div class="value">GHc ${(analytics.summary.insuranceCoveredCents / 100).toFixed(2)}</div></div>
          <div class="metric-card"><div class="label">Referral payments</div><div class="value">GHc ${(analytics.summary.referralAmountDueCents / 100).toFixed(2)}</div></div>
        </div>
      </section>
      <section class="section">
        <h2 class="section-title">Tests and Services</h2>
        <div class="row-list">
          ${
            analytics.topServices.length > 0
              ? analytics.topServices
                  .map(
                    (item) =>
                      `<div class="row-card"><div><strong>${escapeHtml(item.description)}</strong><br /><small>${item.quantity} service item(s) · ${item.invoicesCount} invoice(s)</small></div><strong>GHc ${(item.revenueCents / 100).toFixed(2)}</strong></div>`,
                  )
                  .join("")
              : '<div class="row-card"><div><strong>No services billed in range</strong></div><strong>GHc 0.00</strong></div>'
          }
        </div>
      </section>
      <section class="section">
        <h2 class="section-title">User Performance</h2>
        <div class="row-list">
          ${
            analytics.userPerformance.length > 0
              ? analytics.userPerformance
                  .map(
                    (item) =>
                      `<div class="row-card"><div><strong>${escapeHtml(item.actorName)}</strong><br /><small>Generated GHc ${(item.generatedCents / 100).toFixed(2)} · Net GHc ${(item.netCents / 100).toFixed(2)} · ${item.paymentsCount} payment(s) · ${item.expensesCount} expense entry(ies) · ${item.inventoryActions} inventory action(s)</small></div><strong>GHc ${(item.generatedCents / 100).toFixed(2)}</strong></div>`,
                  )
                  .join("")
              : '<div class="row-card"><div><strong>No user activity in range</strong></div><strong>GHc 0.00</strong></div>'
          }
        </div>
      </section>
      <footer class="footer">
        <div>${escapeHtml(facility.footerMessage)} ${escapeHtml(facility.code)}${facility.location ? ` · ${escapeHtml(facility.location)}` : ""}</div>
        <div class="developer-credit">${escapeHtml(getDeveloperCreditLine())}</div>
      </footer>
    </article>
  </body>
</html>`;

  return {
    fileName,
    html,
  } satisfies PrintableAnalyticsPayload;
}
