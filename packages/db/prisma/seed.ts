import { prisma } from "../src/index.js";
import { catalogSeed } from "@medilab/shared";
import { scryptSync } from "node:crypto";

function hashPin(pin: string, salt: string) {
  return scryptSync(pin, salt, 64).toString("hex");
}

async function main() {
  const facilityCode = process.env.MEDILAB_FACILITY_CODE ?? "MLN-ACC";
  const facilityName =
    process.env.MEDILAB_FACILITY_NAME ?? "MediLab Nexus Diagnostic Centre";

  await prisma.facility.upsert({
    where: { code: facilityCode },
    update: { name: facilityName },
    create: {
      code: facilityCode,
      name: facilityName,
      phone: "+233 20 000 0000",
      email: "hello@medilabnexus.local",
      location: "Community 6, Tema",
      footerMessage:
        "Thank you for choosing MediLab Nexus. Present your Trace Code when requesting support.",
    },
  });

  const facility = await prisma.facility.findUniqueOrThrow({
    where: { code: facilityCode },
  });

  const ensureTraceSequence = async (sequence: number) => {
    if (facility.traceSequence < sequence) {
      await prisma.facility.update({
        where: { id: facility.id },
        data: { traceSequence: sequence },
      });
      facility.traceSequence = sequence;
    }
  };

  const referralDoctorSeed = [
    {
      fullName: "Dr. Akosua Mensah",
      phone: "+233244110001",
      email: "akosua.mensah@referrals.local",
      commissionPercent: 10,
      isActive: true,
    },
    {
      fullName: "Dr. Kojo Amankwah",
      phone: "+233244110002",
      email: "kojo.amankwah@referrals.local",
      commissionPercent: 12,
      isActive: true,
    },
    {
      fullName: "Dr. Efua Owusu",
      phone: "+233244110003",
      email: "efua.owusu@referrals.local",
      commissionPercent: 8,
      isActive: true,
    },
  ];

  for (const doctor of referralDoctorSeed) {
    await prisma.referralDoctor.upsert({
      where: {
        facilityId_fullName: {
          facilityId: facility.id,
          fullName: doctor.fullName,
        },
      },
      update: doctor,
      create: {
        facilityId: facility.id,
        ...doctor,
      },
    });
  }

  for (const item of catalogSeed) {
    await prisma.catalogItem.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        kind: item.kind,
        department: item.department,
        specimenType: item.specimenType,
        modality: item.modality,
        priceCents: item.priceCents,
        tatMinutes: item.tatMinutes,
        rulesJson: item.rulesJson,
        isActive: true,
      },
      create: item,
    });
  }

  const inventorySeed = [
    {
      sku: "VACUTAINER-EDTA",
      category: "Consumable",
      name: "EDTA Vacutainer",
      unit: "pcs",
      quantityOnHand: 64,
      reorderLevel: 100,
      preferredVendor: "Lab Supply Ghana",
      storageLocation: "Lab Store A",
      lastRestockedAt: new Date(),
    },
    {
      sku: "US-GEL-5L",
      category: "Ultrasound Supply",
      name: "Ultrasound Gel 5L",
      unit: "bottles",
      quantityOnHand: 3,
      reorderLevel: 6,
      preferredVendor: "SonoCare West Africa",
      storageLocation: "Imaging Room 1",
      lastRestockedAt: new Date(),
    },
    {
      sku: "URINE-CUP",
      category: "Consumable",
      name: "Sterile Urine Cup",
      unit: "pcs",
      quantityOnHand: 48,
      reorderLevel: 80,
      preferredVendor: "Lab Supply Ghana",
      storageLocation: "Reception Stock",
      lastRestockedAt: new Date(),
    },
    {
      sku: "LFT-REAGENT-KIT",
      category: "Reagent",
      name: "LFT Reagent Kit",
      unit: "kits",
      quantityOnHand: 5,
      reorderLevel: 8,
      preferredVendor: "BioSystems",
      storageLocation: "Cold Room 2",
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21),
      lastRestockedAt: new Date(),
    },
  ];

  for (const item of inventorySeed) {
    await prisma.inventoryItem.upsert({
      where: { sku: item.sku },
      update: item,
      create: item,
    });
  }

  const expenseSeed = [
    {
      category: "Utilities",
      description: "Electricity and generator fuel",
      amountCents: 28500,
      incurredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
      recordedBy: "Finance Desk",
      notes: "Main lab and imaging power support",
    },
    {
      category: "Consumables",
      description: "Vacutainer restock",
      amountCents: 16800,
      incurredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      recordedBy: "Finance Desk",
      notes: "Monthly hematology stock top-up",
    },
    {
      category: "Maintenance",
      description: "Ultrasound probe servicing",
      amountCents: 22500,
      incurredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      recordedBy: "Quality Officer",
      notes: "Mindray DC-70 preventive maintenance",
    },
  ];

  const existingExpenseCount = await prisma.expenseRecord.count({
    where: { facilityId: facility.id },
  });
  if (existingExpenseCount === 0) {
    await prisma.expenseRecord.createMany({
      data: expenseSeed.map((expense) => ({
        facilityId: facility.id,
        ...expense,
      })),
    });
  }

  const qcCount = await prisma.qualityControlEvent.count();

  if (qcCount === 0) {
    await prisma.qualityControlEvent.createMany({
      data: [
        {
          module: "Laboratory",
          instrumentName: "Sysmex XN-330",
          analyte: "Hemoglobin",
          controlLevel: "Normal",
          lotNumber: "QC-HGB-24A",
          observedValue: 13.2,
          meanValue: 13,
          standardDeviation: 0.2,
          expectedRange: "12.8 - 13.6",
          status: "PASS",
          performedBy: "QA Officer",
        },
        {
          module: "Imaging",
          instrumentName: "Mindray DC-70",
          analyte: "Depth Calibration",
          controlLevel: "Phantom",
          lotNumber: "US-PHANTOM-1",
          observedValue: 4.1,
          meanValue: 3.2,
          standardDeviation: 0.2,
          expectedRange: "No drift",
          status: "REVIEW",
          westgardViolationsJson: JSON.stringify(["1_3s"]),
          performedBy: "Radiology QA",
        },
      ],
    });
  }

  const seededUsers = [
    {
      username: "admin",
      displayName: "Local Administrator",
      role: "ADMIN",
      pin: "2468",
    },
    {
      username: "qa.officer",
      displayName: "Quality Officer",
      role: "QA",
      pin: "1357",
    },
    {
      username: "finance.desk",
      displayName: "Finance Desk",
      role: "FINANCE",
      pin: "2244",
    },
    {
      username: "ops.manager",
      displayName: "Operations Manager",
      role: "MANAGER",
      pin: "5566",
    },
    {
      username: "frontdesk",
      displayName: "Front Desk",
      role: "RECEPTION",
      pin: "1122",
    },
    {
      username: "sono.tech",
      displayName: "Sonography Tech",
      role: "SONOGRAPHER",
      pin: "7788",
    },
    {
      username: "doctor.sono",
      displayName: "Sonography Doctor",
      role: "DOCTOR",
      pin: "8899",
    },
  ] as const;

  for (const user of seededUsers) {
    const salt = `${facility.code}-${user.username}`;

    await prisma.appUser.upsert({
      where: { username: user.username },
      update: {
        facilityId: facility.id,
        displayName: user.displayName,
        role: user.role,
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null,
        pinSalt: salt,
        pinHash: hashPin(user.pin, salt),
      },
      create: {
        facilityId: facility.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        pinSalt: salt,
        pinHash: hashPin(user.pin, salt),
      },
    });
  }

  const instrumentCount = await prisma.instrument.count();
  if (instrumentCount === 0) {
    await prisma.instrument.createMany({
      data: [
        {
          name: "Sysmex XN-330",
          category: "ANALYZER",
          serialNumber: "XN330-GH-001",
          location: "Main Lab",
          integrationType: "ASTM",
        },
        {
          name: "Mindray BS-240",
          category: "ANALYZER",
          serialNumber: "BS240-GH-014",
          location: "Chemistry Bench",
          integrationType: "HL7",
        },
        {
          name: "Mindray DC-70",
          category: "ULTRASOUND",
          serialNumber: "DC70-GH-008",
          location: "Ultrasound Room 1",
          integrationType: "DICOM",
        },
      ],
    });
  }

  const instruments = await prisma.instrument.findMany();
  const maintenanceCount = await prisma.maintenanceEvent.count();
  if (maintenanceCount === 0) {
    const sysmex = instruments.find(
      (instrument) => instrument.name === "Sysmex XN-330",
    );
    const dc70 = instruments.find(
      (instrument) => instrument.name === "Mindray DC-70",
    );
    const chemistry = instruments.find(
      (instrument) => instrument.name === "Mindray BS-240",
    );

    await prisma.maintenanceEvent.createMany({
      data: [
        {
          instrumentId: sysmex!.id,
          title: "Daily analyzer calibration",
          status: "DUE",
          scheduledAt: new Date(),
          nextDueAt: new Date(Date.now() + 1000 * 60 * 60 * 6),
          assignedTo: "Quality Officer",
          notes: "Run normal and high controls before morning bench release.",
        },
        {
          instrumentId: chemistry!.id,
          title: "Quarterly preventive maintenance",
          status: "SCHEDULED",
          scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4),
          nextDueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4),
          assignedTo: "Vendor Engineer",
          notes: "Replace tubing and confirm photometer alignment.",
        },
        {
          instrumentId: dc70!.id,
          title: "Ultrasound probe calibration",
          status: "OVERDUE",
          scheduledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
          nextDueAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
          assignedTo: "Radiology QA",
          notes:
            "Validate phantom image depth and measurement overlay accuracy.",
        },
      ],
    });
  }

  const referralDoctors = await prisma.referralDoctor.findMany({
    where: { facilityId: facility.id },
    orderBy: { createdAt: "asc" },
  });
  const catalogItems = await prisma.catalogItem.findMany({
    where: {
      code: {
        in: ["IMG-ABD-US", "IMG-OBS-US", "IMG-ECHO"],
      },
    },
  });

  const sonographySeeds = [
      {
        traceCode: "SG2301",
        traceSequence: 2301,
        initials: "SG",
        firstName: "Selina",
        lastName: "Gyamfi",
        phone: "0243001001",
        gender: "Female",
        referralDoctorId: referralDoctors[0]?.id ?? null,
        accessionNumber: "NX-DEMO-US-001",
        orderedBy: "Front Desk",
        priority: "ROUTINE" as const,
        scheduledFor: new Date(Date.now() + 1000 * 60 * 90),
        serviceCode: "IMG-ABD-US",
        appointmentStatus: "SCHEDULED" as const,
        sonographerName: "Sonography Tech",
        radiologistName: "Dr. Lartey Annan",
        priorStudyReference: "Outside scan 2026-05-14",
        orderStatus: "REGISTERED" as const,
        invoiceStatus: "OPEN" as const,
        amountPaidCents: 0,
      },
      {
        traceCode: "SG2302",
        traceSequence: 2302,
        initials: "SG",
        firstName: "Mabel",
        lastName: "Ofori",
        phone: "0243001002",
        gender: "Female",
        referralDoctorId: referralDoctors[1]?.id ?? null,
        accessionNumber: "NX-DEMO-US-002",
        orderedBy: "Front Desk",
        priority: "URGENT" as const,
        scheduledFor: new Date(Date.now() - 1000 * 60 * 20),
        serviceCode: "IMG-OBS-US",
        appointmentStatus: "SCANNING" as const,
        sonographerName: "Sonography Tech",
        radiologistName: "Dr. Lartey Annan",
        priorStudyReference: "Dating scan 2026-06-02",
        orderStatus: "IN_PROGRESS" as const,
        invoiceStatus: "PARTIAL" as const,
        amountPaidCents: 14000,
      },
      {
        traceCode: "SG2303",
        traceSequence: 2303,
        initials: "SG",
        firstName: "Kwesi",
        lastName: "Ansu",
        phone: "0243001003",
        gender: "Male",
        referralDoctorId: referralDoctors[2]?.id ?? null,
        accessionNumber: "NX-DEMO-US-003",
        orderedBy: "Cardiology Desk",
        priority: "STAT" as const,
        scheduledFor: new Date(Date.now() - 1000 * 60 * 60 * 5),
        serviceCode: "IMG-ECHO",
        appointmentStatus: "REPORTED" as const,
        sonographerName: "Senior Echo Tech",
        radiologistName: "Dr. Lartey Annan",
        priorStudyReference: "Echo 2025-12-08",
        orderStatus: "READY_FOR_REVIEW" as const,
        invoiceStatus: "PAID" as const,
        amountPaidCents: 42000,
        report: {
          title: "Echocardiography Report",
          summary: "Clinical indication: exertional dyspnea and hypertension.",
          findings:
            "FINDINGS:\nLeft ventricular systolic function is preserved. No pericardial effusion. Mild concentric LVH.",
          impression:
            "IMPRESSION:\n1. Preserved left ventricular systolic function with mild concentric LVH.",
          signedBy: "Dr. Lartey Annan",
          status: "RELEASED" as const,
        },
      },
  ];

  for (const seed of sonographySeeds) {
    await ensureTraceSequence(seed.traceSequence);

      let patient = await prisma.patient.findUnique({
        where: { traceCode: seed.traceCode },
      });

      if (!patient) {
        patient = await prisma.patient.create({
          data: {
            facilityId: facility.id,
            referralDoctorId: seed.referralDoctorId,
            traceCode: seed.traceCode,
            traceSequence: seed.traceSequence,
            initials: seed.initials,
            firstName: seed.firstName,
            lastName: seed.lastName,
            phone: seed.phone,
            gender: seed.gender,
            consentAccepted: true,
            syncStatus: "LOCAL_ONLY",
          },
        });
      }

      const catalogItem = catalogItems.find((item) => item.code === seed.serviceCode);
      if (!catalogItem) {
        continue;
      }

      const existingOrder = await prisma.diagnosticOrder.findUnique({
        where: { accessionNumber: seed.accessionNumber },
      });

      const order =
        existingOrder ??
        (await prisma.diagnosticOrder.create({
          data: {
            patientId: patient.id,
            accessionNumber: seed.accessionNumber,
            status: seed.orderStatus,
            priority: seed.priority,
            orderedBy: seed.orderedBy,
            scheduledFor: seed.scheduledFor,
            totalAmountCents: catalogItem.priceCents,
          },
        }));

      if (!existingOrder) {
        const orderItem = await prisma.orderItem.create({
          data: {
            orderId: order.id,
            catalogItemId: catalogItem.id,
            status: seed.orderStatus,
          },
        });

        await prisma.imagingStudy.create({
          data: {
            orderItemId: orderItem.id,
            modality: catalogItem.modality ?? "Ultrasound",
            appointmentStatus: seed.appointmentStatus,
            scheduledAt: seed.scheduledFor,
            sonographerName: seed.sonographerName,
            radiologistName: seed.radiologistName,
            priorStudyReference: seed.priorStudyReference,
            criticalFlag: seed.priority === "STAT",
          },
        });
      }

      const invoice = await prisma.invoice.upsert({
        where: { orderId: order.id },
        update: {
          patientId: patient.id,
          status: seed.invoiceStatus,
          subtotalCents: catalogItem.priceCents,
          amountDueCents: catalogItem.priceCents,
          amountPaidCents: seed.amountPaidCents,
          insuranceCoveredCents: 0,
        },
        create: {
          patientId: patient.id,
          orderId: order.id,
          status: seed.invoiceStatus,
          subtotalCents: catalogItem.priceCents,
          amountDueCents: catalogItem.priceCents,
          amountPaidCents: seed.amountPaidCents,
          insuranceCoveredCents: 0,
        },
      });

      const existingInvoiceLine = await prisma.invoiceLine.findFirst({
        where: {
          invoiceId: invoice.id,
          description: catalogItem.name,
        },
      });

      if (!existingInvoiceLine) {
        await prisma.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            description: catalogItem.name,
            quantity: 1,
            unitPriceCents: catalogItem.priceCents,
            totalPriceCents: catalogItem.priceCents,
          },
        });
      }

      if (seed.amountPaidCents > 0) {
        const existingPayment = await prisma.paymentRecord.findFirst({
          where: {
            invoiceId: invoice.id,
            amountCents: seed.amountPaidCents,
            receivedBy: seed.orderedBy,
          },
        });

        if (!existingPayment) {
          await prisma.paymentRecord.create({
            data: {
              invoiceId: invoice.id,
              method: "CASH",
              amountCents: seed.amountPaidCents,
              receivedBy: seed.orderedBy,
              traceCode: seed.traceCode,
              notes: `Seeded payment for ${catalogItem.name}`,
            },
          });
        }
      }

      if (seed.report) {
        const existingReport = await prisma.report.findFirst({
          where: { orderId: order.id },
        });

        if (!existingReport) {
          await prisma.report.create({
            data: {
              patientId: patient.id,
              orderId: order.id,
              title: seed.report.title,
              status: seed.report.status,
              summary: seed.report.summary,
              findings: seed.report.findings,
              impression: seed.report.impression,
              signedBy: seed.report.signedBy,
              signedAt: new Date(),
            },
          });
        }
      }
    }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
