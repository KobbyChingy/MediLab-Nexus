import { PrismaClient, CatalogKind, Department, UserRole } from "@prisma/client";

type RequestedService = {
  code: string;
  name: string;
  priceCents: number;
  tatMinutes: number;
  modality: string;
  rulesTemplate: string;
};

type RequestedTemplate = {
  name: string;
  title: string;
  templateKind:
    | "LAB_STANDARD"
    | "ULTRASOUND_STANDARD"
    | "ULTRASOUND_ABDOMINAL"
    | "ULTRASOUND_PELVIC"
    | "ULTRASOUND_OBSTETRIC"
    | "ULTRASOUND_ECHOCARDIOGRAPHY";
  summary: string;
  findings: string;
  impression: string;
  assist?: Record<string, string>;
  echoWorksheet?: Record<string, string>;
};

const requestedServices: RequestedService[] = [
  {
    code: "IMG-ECHO-ADULT",
    name: "Echocardiography Adult Report",
    priceCents: 50000,
    tatMinutes: 90,
    modality: "Ultrasound",
    rulesTemplate: "echo-adult",
  },
  {
    code: "IMG-ECHO-YOUNG",
    name: "Echocardiography Young Report",
    priceCents: 45000,
    tatMinutes: 90,
    modality: "Ultrasound",
    rulesTemplate: "echo-young",
  },
  {
    code: "IMG-ABD-SCAN",
    name: "Abdomen Scan",
    priceCents: 25000,
    tatMinutes: 60,
    modality: "Ultrasound",
    rulesTemplate: "abdominal",
  },
  {
    code: "IMG-ABDPEL-SCAN",
    name: "Abdomen pelvic Scan",
    priceCents: 28000,
    tatMinutes: 75,
    modality: "Ultrasound",
    rulesTemplate: "abdominopelvic",
  },
  {
    code: "IMG-OBS-SCAN",
    name: "Obedstrics Scan",
    priceCents: 15000,
    tatMinutes: 60,
    modality: "Ultrasound",
    rulesTemplate: "obstetric",
  },
  {
    code: "IMG-PELPER-SCAN",
    name: "Pelvic personal Scan",
    priceCents: 10000,
    tatMinutes: 60,
    modality: "Ultrasound",
    rulesTemplate: "pelvic",
  },
  {
    code: "IMG-PELDR-SCAN",
    name: "Pelvic from Doctor scan",
    priceCents: 15000,
    tatMinutes: 60,
    modality: "Ultrasound",
    rulesTemplate: "pelvic",
  },
  {
    code: "IMG-PROSTATE-SCAN",
    name: "Prostate Scan",
    priceCents: 30000,
    tatMinutes: 60,
    modality: "Ultrasound",
    rulesTemplate: "prostate",
  },
  {
    code: "IMG-SCROTAL-SCAN",
    name: "Scrotal Scan",
    priceCents: 30000,
    tatMinutes: 60,
    modality: "Ultrasound",
    rulesTemplate: "scrotal",
  },
  {
    code: "IMG-BREAST-SCAN",
    name: "Breast Scan",
    priceCents: 30000,
    tatMinutes: 60,
    modality: "Ultrasound",
    rulesTemplate: "breast",
  },
  {
    code: "IMG-LUMPS-SCAN",
    name: "Lumps Scan",
    priceCents: 30000,
    tatMinutes: 60,
    modality: "Ultrasound",
    rulesTemplate: "lumps",
  },
  {
    code: "IMG-CAROTID-SCAN",
    name: "Carotid Scan",
    priceCents: 50000,
    tatMinutes: 90,
    modality: "Ultrasound",
    rulesTemplate: "carotid",
  },
  {
    code: "IMG-NECK-SCAN",
    name: "Neck Scan",
    priceCents: 30000,
    tatMinutes: 60,
    modality: "Ultrasound",
    rulesTemplate: "neck",
  },
  {
    code: "IMG-DVT-DOPPLER",
    name: "Dvt doppler Scan",
    priceCents: 35000,
    tatMinutes: 90,
    modality: "Ultrasound",
    rulesTemplate: "dvt-doppler",
  },
  {
    code: "IMG-ECG-SCAN",
    name: "ELECTROCARDIO GRAM Scan",
    priceCents: 25000,
    tatMinutes: 45,
    modality: "ECG",
    rulesTemplate: "ecg",
  },
];

function htmlParagraphs(lines: string[]) {
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line) => `<p>${line}</p>`)
    .join("");
}

function buildEchoWorksheet(conclusion: string, indications: string) {
  return {
    studyDate: new Date().toISOString().slice(0, 10),
    referringPhysician: "",
    indications,
    height: "",
    weight: "",
    bodySurfaceArea: "",
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    lvidd: "",
    lvids: "",
    ivsd: "",
    ivss: "",
    lvpwd: "",
    lvpws: "",
    rvd: "",
    aoRoot: "",
    la: "",
    avCusp: "",
    lvot: "",
    ef: "",
    effusion: "",
    thrombus: "",
    wallMotion: "",
    rvsp: "",
    mitralEa: "",
    mvp: "",
    avCuspsTrileaflet: "",
    aorticPpg: "",
    pulmonicPpg: "",
    tricuspidPpg: "",
    mitralPpg: "",
    aorticMpg: "",
    pulmonicMpg: "",
    tricuspidMpg: "",
    mitralMpg: "",
    aorticVelocity: "",
    pulmonicVelocity: "",
    tricuspidVelocity: "",
    mitralVelocity: "",
    aorticValveArea: "",
    pulmonicValveArea: "",
    tricuspidValveArea: "",
    mitralValveArea: "",
    aorticPht: "",
    pulmonicPht: "",
    tricuspidPht: "",
    mitralPht: "",
    aorticRegurge: "",
    pulmonicRegurge: "",
    tricuspidRegurge: "",
    mitralRegurge: "",
    comments: "",
    conclusion,
  };
}

const requestedTemplates: RequestedTemplate[] = [
  {
    name: "General template",
    title: "General Report",
    templateKind: "LAB_STANDARD",
    summary: "General reusable report template",
    findings: [
      '<table><tbody>',
      '<tr><td><strong>Name:</strong></td><td></td><td><strong>Age:</strong></td><td></td><td><strong>Sex:</strong></td><td></td></tr>',
      '<tr><td><strong>Date:</strong></td><td></td><td><strong>Reference:</strong></td><td colspan="3"></td></tr>',
      '<tr><td><strong>Clinical details:</strong></td><td colspan="5"></td></tr>',
      '</tbody></table>',
      '<p><strong>Report:</strong></p>',
      '<p></p>',
      '<p><strong>Impression:</strong></p>',
      '<p></p>',
    ].join(""),
    impression: "",
    assist: {
      recommendation: "",
    },
  },
  {
    name: "Echocardiography Adult Report",
    title: "Echocardiography Adult Report",
    templateKind: "ULTRASOUND_ECHOCARDIOGRAPHY",
    summary: "Clinical indication: adult cardiac structure and function assessment",
    findings: htmlParagraphs([
      "Adult echocardiography worksheet template ready for completion.",
    ]),
    impression: htmlParagraphs([
      "Complete the echocardiography worksheet and finalize the conclusion before release.",
    ]),
    assist: {
      sonographerName: "",
      technique: "Transthoracic echocardiography with 2D, M-mode, and Doppler assessment.",
      measurementsText: "EF, chamber sizes, valve gradients, wall motion, pericardial findings.",
      recommendation: "Cardiology review as clinically indicated.",
    },
    echoWorksheet: buildEchoWorksheet(
      "Adult echocardiography worksheet completed.",
      "Adult cardiac structure and function assessment.",
    ),
  },
  {
    name: "Echocardiography Young Report",
    title: "Echocardiography Young Report",
    templateKind: "ULTRASOUND_ECHOCARDIOGRAPHY",
    summary: "Clinical indication: young patient cardiac structure and function assessment",
    findings: htmlParagraphs([
      "Young echocardiography worksheet template ready for completion.",
    ]),
    impression: htmlParagraphs([
      "Complete the echocardiography worksheet and finalize the conclusion before release.",
    ]),
    assist: {
      sonographerName: "",
      technique: "Transthoracic echocardiography with age-appropriate 2D, M-mode, and Doppler assessment.",
      measurementsText: "EF, chamber sizes, valve gradients, septal review, pericardial findings.",
      recommendation: "Cardiology or pediatric follow-up as clinically indicated.",
    },
    echoWorksheet: buildEchoWorksheet(
      "Young echocardiography worksheet completed.",
      "Young patient cardiac structure and function assessment.",
    ),
  },
  {
    name: "Abdomen Scan",
    title: "Abdomen Scan Report",
    templateKind: "ULTRASOUND_ABDOMINAL",
    summary: "Clinical indication: abdominal ultrasound assessment",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Liver:",
      "Gallbladder:",
      "Pancreas:",
      "Spleen:",
      "Kidneys:",
      "Aorta / IVC:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Transabdominal sonography with focused hepatobiliary and renal survey.",
      liverSpan: "",
      gallbladder: "",
      biliaryTree: "",
      renalSurvey: "",
    },
  },
  {
    name: "Abdomen pelvic Scan",
    title: "Abdomen pelvic Scan Report",
    templateKind: "ULTRASOUND_STANDARD",
    summary: "Clinical indication: combined abdominal and pelvic ultrasound assessment",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Liver:",
      "Gallbladder:",
      "Pancreas:",
      "Spleen:",
      "Kidneys:",
      "Uterus / Prostate:",
      "Adnexa / Bladder:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Combined abdominal and pelvic sonography.",
      recommendation: "Correlate with the patient history and laboratory findings.",
    },
  },
  {
    name: "Obedstrics Scan",
    title: "Obedstrics Scan Report",
    templateKind: "ULTRASOUND_OBSTETRIC",
    summary: "Clinical indication: obstetric ultrasound assessment",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Fetal lie / presentation:",
      "Placenta:",
      "Liquor volume:",
      "Biometry:",
      "Fetal heart activity:",
      "Cervix:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Transabdominal obstetric sonography with fetal biometry and placental review.",
      gestationalAge: "",
      fetalHeartRate: "",
      placentaLocation: "",
      amnioticFluid: "",
    },
  },
  {
    name: "Pelvic personal Scan",
    title: "Pelvic personal Scan Report",
    templateKind: "ULTRASOUND_PELVIC",
    summary: "Clinical indication: pelvic ultrasound assessment",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Uterus:",
      "Endometrium:",
      "Right adnexa:",
      "Left adnexa:",
      "Cul-de-sac:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Transabdominal pelvic sonography with transvaginal correlation when indicated.",
      uterineSize: "",
      endometriumThickness: "",
      rightAdnexa: "",
      leftAdnexa: "",
    },
  },
  {
    name: "Pelvic from Doctor scan",
    title: "Pelvic from Doctor scan Report",
    templateKind: "ULTRASOUND_PELVIC",
    summary: "Clinical indication: doctor-requested pelvic ultrasound assessment",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Uterus:",
      "Endometrium:",
      "Right adnexa:",
      "Left adnexa:",
      "Cul-de-sac:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Pelvic sonography performed following clinician request.",
      uterineSize: "",
      endometriumThickness: "",
      rightAdnexa: "",
      leftAdnexa: "",
    },
  },
  {
    name: "Prostate Scan",
    title: "Prostate Scan Report",
    templateKind: "ULTRASOUND_STANDARD",
    summary: "Clinical indication: prostate ultrasound assessment",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Prostate size and volume:",
      "Echotexture:",
      "Bladder base impression:",
      "Post-void residual:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Pelvic/prostate sonography.",
      recommendation: "Urology review if clinically indicated.",
    },
  },
  {
    name: "Scrotal Scan",
    title: "Scrotal Scan Report",
    templateKind: "ULTRASOUND_STANDARD",
    summary: "Clinical indication: scrotal ultrasound assessment",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Right testis:",
      "Left testis:",
      "Epididymis:",
      "Hydrocele / varicocele:",
      "Doppler flow:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Scrotal sonography with Doppler assessment.",
      recommendation: "Clinical correlation and surgical review if required.",
    },
  },
  {
    name: "Breast Scan",
    title: "Breast Scan Report",
    templateKind: "ULTRASOUND_STANDARD",
    summary: "Clinical indication: breast ultrasound assessment",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Right breast:",
      "Left breast:",
      "Axillary regions:",
      "Focal lesion description:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Breast sonography with focused lesion assessment.",
      recommendation: "BI-RADS correlation or further imaging if indicated.",
    },
  },
  {
    name: "Lumps Scan",
    title: "Lumps Scan Report",
    templateKind: "ULTRASOUND_STANDARD",
    summary: "Clinical indication: soft-tissue lump ultrasound assessment",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Site of lump:",
      "Size:",
      "Margins:",
      "Internal echoes:",
      "Vascularity:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Targeted soft-tissue sonography.",
      recommendation: "Clinical correlation or tissue diagnosis if indicated.",
    },
  },
  {
    name: "Carotid Scan",
    title: "Carotid Scan Report",
    templateKind: "ULTRASOUND_STANDARD",
    summary: "Clinical indication: carotid Doppler ultrasound assessment",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Right common carotid artery:",
      "Right internal carotid artery:",
      "Left common carotid artery:",
      "Left internal carotid artery:",
      "Plaque / stenosis / Doppler velocities:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Carotid Doppler sonography.",
      recommendation: "Vascular or stroke review when clinically indicated.",
    },
  },
  {
    name: "Neck Scan",
    title: "Neck Scan Report",
    templateKind: "ULTRASOUND_STANDARD",
    summary: "Clinical indication: neck ultrasound assessment",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Thyroid gland:",
      "Cervical lymph nodes:",
      "Soft tissues:",
      "Focal lesion description:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Focused neck sonography.",
      recommendation: "Clinical correlation and ENT review if required.",
    },
  },
  {
    name: "Dvt doppler Scan",
    title: "Dvt doppler Scan Report",
    templateKind: "ULTRASOUND_STANDARD",
    summary: "Clinical indication: lower-limb DVT Doppler assessment",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Common femoral vein:",
      "Superficial femoral vein:",
      "Popliteal vein:",
      "Calf veins:",
      "Compressibility / flow:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Lower-limb venous Doppler sonography.",
      recommendation: "Urgent clinical review if thrombosis is present.",
    },
  },
  {
    name: "ELECTROCARDIO GRAM Scan",
    title: "ELECTROCARDIO GRAM Scan Report",
    templateKind: "ULTRASOUND_STANDARD",
    summary: "Clinical indication: electrocardiogram review",
    findings: htmlParagraphs([
      "FINDINGS:",
      "Rate:",
      "Rhythm:",
      "Axis:",
      "Intervals:",
      "ST-T changes:",
    ]),
    impression: htmlParagraphs(["IMPRESSION:", "1. "]),
    assist: {
      technique: "Standard ECG acquisition and interpretation.",
      recommendation: "Cardiology review if clinically indicated.",
    },
  },
];

async function upsertServices(prisma: PrismaClient) {
  for (const service of requestedServices) {
    await prisma.catalogItem.upsert({
      where: { code: service.code },
      update: {
        name: service.name,
        kind: CatalogKind.IMAGING,
        department: Department.IMAGING,
        specimenType: null,
        modality: service.modality,
        priceCents: service.priceCents,
        tatMinutes: service.tatMinutes,
        isActive: true,
        rulesJson: JSON.stringify({
          template: service.rulesTemplate,
          dicom: service.modality !== "ECG",
          measurements: true,
        }),
      },
      create: {
        code: service.code,
        name: service.name,
        kind: CatalogKind.IMAGING,
        department: Department.IMAGING,
        specimenType: null,
        modality: service.modality,
        priceCents: service.priceCents,
        tatMinutes: service.tatMinutes,
        isActive: true,
        rulesJson: JSON.stringify({
          template: service.rulesTemplate,
          dicom: service.modality !== "ECG",
          measurements: true,
        }),
      },
    });
  }
}

async function upsertTemplates(prisma: PrismaClient) {
  const facilities = await prisma.facility.findMany({
    include: {
      users: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  for (const facility of facilities) {
    const author =
      facility.users.find((user) => user.role === UserRole.ADMIN) ??
      facility.users[0] ??
      null;
    const createdByName = author?.displayName ?? "System Administrator";
    const createdByRole = author?.role ?? UserRole.ADMIN;

    for (const template of requestedTemplates) {
      const assistJson = {
        sonographerName: "",
        technique: "",
        measurementsText: "",
        recommendation: "",
        echoWorksheetJson: template.echoWorksheet
          ? JSON.stringify(template.echoWorksheet)
          : "",
        gestationalAge: "",
        fetalHeartRate: "",
        placentaLocation: "",
        amnioticFluid: "",
        liverSpan: "",
        gallbladder: "",
        biliaryTree: "",
        renalSurvey: "",
        uterineSize: "",
        endometriumThickness: "",
        rightAdnexa: "",
        leftAdnexa: "",
        ejectionFraction: "",
        chamberAssessment: "",
        valveAssessment: "",
        pericardium: "",
        ...(template.assist ?? {}),
      };

      await prisma.reportTemplate.upsert({
        where: {
          facilityId_name: {
            facilityId: facility.id,
            name: template.name,
          },
        },
        update: {
          templateKind: template.templateKind,
          title: template.title,
          medicalHistory: "",
          summary: template.summary,
          findings: template.findings,
          impression: template.impression,
          assistJson: JSON.stringify(assistJson),
          createdByName,
          createdByRole,
        },
        create: {
          facilityId: facility.id,
          name: template.name,
          templateKind: template.templateKind,
          title: template.title,
          medicalHistory: "",
          summary: template.summary,
          findings: template.findings,
          impression: template.impression,
          assistJson: JSON.stringify(assistJson),
          createdByName,
          createdByRole,
        },
      });
    }
  }
}

export async function bootstrapRequestedServices(prisma: PrismaClient) {
  await upsertServices(prisma);
  await upsertTemplates(prisma);
}

async function main() {
  const prisma = new PrismaClient();
  await bootstrapRequestedServices(prisma);
  console.log(
    `Bootstrapped ${requestedServices.length} services and ${requestedTemplates.length} named templates.`,
  );
  await prisma.$disconnect();
}

main()
  .catch(async (error) => {
    const prisma = new PrismaClient();
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });