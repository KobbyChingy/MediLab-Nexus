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
  const title = report.title.toLowerCase();
  const findings = report.findings.toLowerCase();
  return (
    title.includes("echocardi") ||
    findings.includes("adult echocardiography worksheet")
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
      .echo-sheet { background: #fff; border: 1px solid #1f2937; box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08); }
      .echo-header { padding: 16px 20px 10px; border-bottom: 1px solid #1f2937; }
      .letterhead { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: start; }
      .letterhead img { width: 64px; height: 64px; object-fit: contain; }
      .letterhead-copy { display: grid; gap: 2px; }
      .letterhead-copy h1, .letterhead-copy p, .letterhead-copy h2 { margin: 0; }
      .facility-name { font-size: 22px; font-weight: 800; letter-spacing: 0.03em; text-transform: uppercase; }
      .facility-meta { font-size: 13px; line-height: 1.5; }
      .report-title { margin-top: 8px; font-size: 18px; font-weight: 800; text-transform: uppercase; text-decoration: underline; letter-spacing: 0.03em; }
      .echo-paper .echo-print-content { padding: 18px 20px 20px; }
      .echo-section { padding: 16px 20px 18px; border-top: 1px solid #d1d5db; }
      .echo-footer { background: #fff; border: 1px solid #1f2937; padding: 16px 20px 18px; display: grid; gap: 12px; }
      .echo-footer h3 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; }
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
        body { padding: 0; background: #fff; }
        .workspace { max-width: none; }
        .print-button { display: none; }
        .echo-sheet, .echo-footer { box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <div class="workspace">
      <div class="actions">
        <button class="print-button" type="button" onclick="window.print()">Print report</button>
      </div>
      <article class="echo-sheet">
        <header class="echo-header">
          <div class="letterhead">
            <img src="${getFacilityLogoSrc(facility)}" alt="Facility logo" />
            <div class="letterhead-copy">
              <h1 class="facility-name">${escapeHtml(facility.name)}</h1>
              ${facility.location ? `<p class="facility-meta">${escapeHtml(facility.location)}</p>` : ""}
              ${facility.phone || facility.email ? `<p class="facility-meta">${escapeHtml([facility.phone, facility.email].filter(Boolean).join(" / "))}</p>` : ""}
              <h2 class="report-title">${escapeHtml(report.title)}</h2>
            </div>
          </div>
        </header>
        <div class="echo-print-content">
          <div class="body-copy">${renderRichText(description)}</div>
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
      .brand-copy .facility-name { font-size: calc(var(--print-title-size) - 8px); font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
      .brand-copy h1 { font-size: var(--print-title-size); text-transform: uppercase; letter-spacing: 0.03em; }
      .brand-copy h2 { font-size: var(--print-copy-size); text-transform: uppercase; text-decoration: underline; margin-top: 6px; }
      .print-button { border: 0; border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 700; color: #1f1f1f; background: #f3f4f6; cursor: pointer; }
      .meta { border-bottom: 1px solid #e4e4e4; }
      .rule { margin-top: 10px; border-top: 2px solid #1f1f1f; }
      .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 20px; }
      .meta-line { display: grid; grid-template-columns: 110px 1fr; gap: 8px; align-items: baseline; }
      .label { font-size: var(--print-copy-size); font-weight: 700; text-transform: uppercase; }
      .value { font-size: var(--print-body-size); }
      .section { border-bottom: 1px solid #ececec; font-size: var(--print-body-size); }
      .section h3 { margin: 0 0 8px; font-size: var(--print-section-title-size); text-transform: uppercase; text-decoration: underline; }
      .body-copy { line-height: 1.65; white-space: normal; font-size: 15px; }
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
      @media (max-width: 720px) {
        .brand-row, .brand-main { flex-direction: column; }
        .brand-actions { justify-items: start; }
        .meta-grid, .signoff { grid-template-columns: 1fr; }
      }
      @media print {
        body { background: white; padding: 0; }
        .sheet { box-shadow: none; border: none; }
        .print-button { display: none; }
        .body-copy .editor-page-break { break-before: page; page-break-before: always; border: 0; margin: 0; }
        .body-copy .editor-page-break::before { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="sheet-wrap">
    <img class="watermark" src="${getFacilityLogoSrc(facility)}" alt="" />
    <article class="sheet">
      <header class="hero">
        <div class="brand-row">
          <div class="brand-main">
            <div class="brand-mark">
              <img src="${getFacilityLogoSrc(facility)}" alt="Facility logo" />
            </div>
            <div class="brand-copy">
              <p class="facility-name">${escapeHtml(facility.name)}</p>
              ${facility.location ? `<p>${escapeHtml(facility.location)}</p>` : ""}
              ${facility.phone || facility.email ? `<p>${escapeHtml([facility.phone, facility.email].filter(Boolean).join(" / "))}</p>` : ""}
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
      <section class="section"><h3>History</h3><div class="body-copy">${renderRichText(history)}</div></section>
      <section class="section"><h3>Description</h3><div class="body-copy">${renderRichText(description)}</div></section>
      ${impression ? `<section class="section"><h3>Impression</h3><div class="body-copy">${renderRichText(impression)}</div></section>` : ""}
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
      payment.invoice.order.items
        .map((item) => item.catalogItem.name)
        .join(", ") || "Diagnostic services",
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
  const sections = [
    ["History", bundle.report.medicalHistory?.trim() || "Not provided."],
    ["Description", bundle.report.findings.trim()],
    ["Impression", bundle.report.impression.trim()],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>;

  await new Promise<void>((resolve, reject) => {
    doc.pipe(stream);
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
    balanceCents,
    fileName,
  } = bundle;
  const patientGender =
    payment.invoice.patient.gender?.trim() || "Not recorded";
  const receiptDate = payment.createdAt.toLocaleDateString();
  const receiptTimestamp = payment.createdAt.toLocaleString();
  const paidAmount = `GHc ${(payment.amountCents / 100).toFixed(2)}`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Receipt ${escapeHtml(payment.invoice.patient.traceCode)}</title>
    <style>
      :root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; ${getPrintTypographyCss(facility)} color: #16304a; background: #eef5ff; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 24px; background: linear-gradient(180deg, #edf4ff, #f9fcff); }
      .sheet { max-width: 760px; margin: 0 auto; background: #ffffff; border: 1px solid rgba(15, 42, 78, 0.1); border-radius: 24px; overflow: hidden; box-shadow: 0 18px 42px rgba(15, 42, 78, 0.1); }
      .hero { display: flex; justify-content: space-between; gap: 18px; align-items: center; padding: 28px 32px; background: linear-gradient(135deg, #0f6bff, #00c4b4); color: #ffffff; }
      .hero img { width: 74px; height: 74px; object-fit: contain; border-radius: 18px; background: rgba(255,255,255,0.12); padding: 8px; }
      .hero-side { display: grid; justify-items: end; gap: 12px; }
      .hero h1, .hero p { margin: 0; }
      .hero h1 { margin-top: 8px; font-size: var(--print-title-size); }
      .contact { margin-top: 8px; opacity: 0.92; font-size: var(--print-copy-size); }
      .print-button { border: 0; border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 700; color: #0f3f75; background: #ffffff; cursor: pointer; }
      .section { padding: 22px 32px; border-top: 1px solid rgba(15, 42, 78, 0.08); }
      .meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
      .meta-card, .summary-card { border: 1px solid rgba(15, 42, 78, 0.08); border-radius: 18px; padding: 16px; background: #f8fbff; }
      .label { font-size: calc(var(--print-copy-size) - 2px); text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; }
      .value { margin-top: 6px; font-size: var(--print-metric-size); font-weight: 700; color: #10233d; }
      .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
      .footer { padding: 22px 32px; color: #5b6d82; background: #f8fbff; font-size: var(--print-copy-size); display: grid; gap: 6px; }
      .developer-credit { color: #6b7280; font-size: 12px; }
      @media print { body { padding: 0; background: #fff; } .sheet { border: 0; border-radius: 0; box-shadow: none; } .print-button { display: none; } }
    </style>
  </head>
  <body>
    <article class="sheet">
      <header class="hero">
        <div>
          <p>${escapeHtml(facility.name)}</p>
          <h1>Payment Receipt</h1>
          <p class="contact">${escapeHtml(getFacilityContactLine(facility) || facility.code)}</p>
        </div>
        <div class="hero-side">
          <button class="print-button" type="button" onclick="window.print()">Print receipt</button>
          <img src="${getFacilityLogoSrc(facility)}" alt="Facility logo" />
        </div>
      </header>
      <section class="section">
        <div class="meta-grid">
          <div class="meta-card"><div class="label">Patient</div><div class="value">${escapeHtml(patientName)}</div></div>
          <div class="meta-card"><div class="label">Gender</div><div class="value">${escapeHtml(patientGender)}</div></div>
          <div class="meta-card"><div class="label">Trace Code</div><div class="value">${escapeHtml(payment.invoice.patient.traceCode)}</div></div>
          <div class="meta-card"><div class="label">Receipt Date</div><div class="value">${escapeHtml(receiptDate)}</div></div>
          <div class="meta-card"><div class="label">Amount Paid</div><div class="value">${escapeHtml(paidAmount)}</div></div>
          <div class="meta-card"><div class="label">Accession</div><div class="value">${escapeHtml(payment.invoice.order.accessionNumber)}</div></div>
          <div class="meta-card"><div class="label">Received At</div><div class="value">${escapeHtml(receiptTimestamp)}</div></div>
        </div>
      </section>
      <section class="section">
        <div class="summary-grid">
          <div class="summary-card"><div class="label">Paid</div><div class="value">${escapeHtml(paidAmount)}</div></div>
          <div class="summary-card"><div class="label">Invoice Due</div><div class="value">GHc ${(payment.invoice.amountDueCents / 100).toFixed(2)}</div></div>
          <div class="summary-card"><div class="label">Balance</div><div class="value">GHc ${(balanceCents / 100).toFixed(2)}</div></div>
        </div>
      </section>
      <section class="section">
        <div class="meta-grid">
          <div class="meta-card"><div class="label">Payment Method</div><div class="value">${escapeHtml(payment.method)}</div></div>
          <div class="meta-card"><div class="label">Reference</div><div class="value">${escapeHtml(payment.reference || "Walk-in payment")}</div></div>
          <div class="meta-card"><div class="label">Received By</div><div class="value">${escapeHtml(payment.receivedBy)}</div></div>
          <div class="meta-card"><div class="label">Services</div><div class="value">${escapeHtml(orderedItems)}</div></div>
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
      :root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; ${getPrintTypographyCss(facility)} color: #16304a; background: #eef5ff; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 24px; background: linear-gradient(180deg, #edf4ff, #f9fcff); }
      .sheet { max-width: 840px; margin: 0 auto; background: #ffffff; border: 1px solid rgba(15, 42, 78, 0.1); border-radius: 24px; overflow: hidden; box-shadow: 0 18px 42px rgba(15, 42, 78, 0.1); }
      .hero { display: flex; justify-content: space-between; gap: 18px; align-items: center; padding: 28px 32px; background: linear-gradient(135deg, #0f6bff, #00c4b4); color: #ffffff; }
      .hero img { width: 74px; height: 74px; object-fit: contain; border-radius: 18px; background: rgba(255,255,255,0.12); padding: 8px; }
      .hero-side { display: grid; justify-items: end; gap: 12px; }
      .hero h1, .hero p { margin: 0; }
      .hero h1 { margin-top: 8px; font-size: var(--print-title-size); }
      .contact { margin-top: 8px; opacity: 0.92; font-size: var(--print-copy-size); }
      .print-button { border: 0; border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 700; color: #0f3f75; background: #ffffff; cursor: pointer; }
      .section { padding: 22px 32px; border-top: 1px solid rgba(15, 42, 78, 0.08); }
      .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .meta-card, .summary-card, .line-item { border: 1px solid rgba(15, 42, 78, 0.08); border-radius: 18px; padding: 16px; background: #f8fbff; }
      .label { font-size: calc(var(--print-copy-size) - 2px); text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; }
      .value { margin-top: 6px; font-size: var(--print-metric-size); font-weight: 700; color: #10233d; }
      .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
      .line-items { display: grid; gap: 12px; }
      .line-item { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
      .line-item small { color: #64748b; }
      .footer { padding: 22px 32px; color: #5b6d82; background: #f8fbff; font-size: var(--print-copy-size); display: grid; gap: 6px; }
      .developer-credit { color: #6b7280; font-size: 12px; }
      @media print { body { padding: 0; background: #fff; } .sheet { border: 0; border-radius: 0; box-shadow: none; } .print-button { display: none; } }
    </style>
  </head>
  <body>
    <article class="sheet">
      <header class="hero">
        <div>
          <p>${escapeHtml(facility.name)}</p>
          <h1>Invoice Statement</h1>
          <p class="contact">${escapeHtml(getFacilityContactLine(facility) || facility.code)}</p>
        </div>
        <div class="hero-side">
          <button class="print-button" type="button" onclick="window.print()">Print invoice</button>
          <img src="${getFacilityLogoSrc(facility)}" alt="Facility logo" />
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
      :root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; ${getPrintTypographyCss(facility)} color: #16304a; background: #eef5ff; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 24px; background: linear-gradient(180deg, #edf4ff, #f9fcff); }
      .sheet { max-width: 980px; margin: 0 auto; background: #ffffff; border: 1px solid rgba(15, 42, 78, 0.1); border-radius: 24px; overflow: hidden; box-shadow: 0 18px 42px rgba(15, 42, 78, 0.1); }
      .hero { display: flex; justify-content: space-between; gap: 18px; align-items: center; padding: 28px 32px; background: linear-gradient(135deg, #0f6bff, #00c4b4); color: #ffffff; }
      .hero img { width: 74px; height: 74px; object-fit: contain; border-radius: 18px; background: rgba(255,255,255,0.12); padding: 8px; }
      .hero-side { display: grid; justify-items: end; gap: 12px; }
      .hero h1, .hero p { margin: 0; }
      .hero h1 { margin-top: 8px; font-size: var(--print-title-size); }
      .contact { margin-top: 8px; opacity: 0.92; font-size: var(--print-copy-size); }
      .print-button { border: 0; border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 700; color: #0f3f75; background: #ffffff; cursor: pointer; }
      .section { padding: 22px 32px; border-top: 1px solid rgba(15, 42, 78, 0.08); }
      .section-title { margin: 0 0 14px; font-size: var(--print-section-title-size); color: #10233d; }
      .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
      .metric-card, .row-card { border: 1px solid rgba(15, 42, 78, 0.08); border-radius: 18px; padding: 16px; background: #f8fbff; }
      .row-list { display: grid; gap: 12px; }
      .row-card { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
      .label { font-size: calc(var(--print-copy-size) - 2px); text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; }
      .value { margin-top: 6px; font-size: var(--print-metric-size); font-weight: 700; color: #10233d; }
      .footer { padding: 22px 32px; color: #5b6d82; background: #f8fbff; font-size: var(--print-copy-size); display: grid; gap: 6px; }
      .developer-credit { color: #6b7280; font-size: 12px; }
      @media print { body { padding: 0; background: #fff; } .sheet { border: 0; border-radius: 0; box-shadow: none; } .print-button { display: none; } }
    </style>
  </head>
  <body>
    <article class="sheet">
      <header class="hero">
        <div>
          <p>${escapeHtml(facility.name)}</p>
          <h1>Financial Overview</h1>
          <p class="contact">${escapeHtml(rangeLabel)} · Generated ${escapeHtml(new Date(analytics.generatedAt).toLocaleString())}</p>
        </div>
        <div class="hero-side">
          <button class="print-button" type="button" onclick="window.print()">Print overview</button>
          <img src="${getFacilityLogoSrc(facility)}" alt="Facility logo" />
        </div>
      </header>
      <section class="section">
        <div class="metric-grid">
          <div class="metric-card"><div class="label">Revenue</div><div class="value">GHc ${(analytics.summary.grossBilledCents / 100).toFixed(2)}</div></div>
          <div class="metric-card"><div class="label">Profit</div><div class="value">GHc ${(analytics.summary.netProfitCents / 100).toFixed(2)}</div></div>
          <div class="metric-card"><div class="label">Expenses</div><div class="value">GHc ${(analytics.summary.expenseCents / 100).toFixed(2)}</div></div>
          <div class="metric-card"><div class="label">Collected</div><div class="value">GHc ${(analytics.summary.collectedCents / 100).toFixed(2)}</div></div>
          <div class="metric-card"><div class="label">Payer cover</div><div class="value">GHc ${(analytics.summary.insuranceCoveredCents / 100).toFixed(2)}</div></div>
          <div class="metric-card"><div class="label">Referral payments</div><div class="value">GHc ${(analytics.summary.referralCommissionDueCents / 100).toFixed(2)}</div></div>
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
