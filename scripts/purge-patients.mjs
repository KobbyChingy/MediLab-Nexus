import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const patients = await prisma.patient.findMany({
    select: { id: true },
  });
  const patientIds = patients.map((patient) => patient.id);

  if (patientIds.length === 0) {
    console.log("Deleted patients:0");
    process.exit(0);
  }

  const orderIds = (
    await prisma.diagnosticOrder.findMany({
      where: { patientId: { in: patientIds } },
      select: { id: true },
    })
  ).map((order) => order.id);

  const invoiceIds = (
    await prisma.invoice.findMany({
      where: { patientId: { in: patientIds } },
      select: { id: true },
    })
  ).map((invoice) => invoice.id);

  const orderItemIds = orderIds.length
    ? (
        await prisma.orderItem.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true },
        })
      ).map((orderItem) => orderItem.id)
    : [];

  await prisma.$transaction(async (tx) => {
    if (invoiceIds.length > 0) {
      await tx.paymentRecord.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
      await tx.invoiceLine.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
    }

    if (orderItemIds.length > 0) {
      await tx.imagingStudy.deleteMany({
        where: { orderItemId: { in: orderItemIds } },
      });
    }

    await tx.report.deleteMany({ where: { patientId: { in: patientIds } } });
    await tx.sample.deleteMany({ where: { patientId: { in: patientIds } } });
    await tx.notificationQueue.deleteMany({
      where: { patientId: { in: patientIds } },
    });

    if (invoiceIds.length > 0) {
      await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    }

    if (orderIds.length > 0) {
      await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.diagnosticOrder.deleteMany({ where: { id: { in: orderIds } } });
    }

    await tx.patient.deleteMany({ where: { id: { in: patientIds } } });
  });

  console.log(`Deleted patients:${patientIds.length}`);
  console.log(`Remaining patients:${await prisma.patient.count()}`);
} finally {
  await prisma.$disconnect();
}
