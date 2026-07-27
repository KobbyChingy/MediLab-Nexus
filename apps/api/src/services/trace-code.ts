import type { PrismaClient } from "@medilab/db";

type NameParts = {
  firstName: string;
  lastName: string;
  middleName?: string;
};

export function buildInitials({ firstName, lastName, middleName }: NameParts) {
  const raw = [firstName, middleName, lastName]
    .filter(Boolean)
    .map((part) => part!.trim()[0]?.toUpperCase() ?? "")
    .join("");

  return raw.slice(0, 3) || "PT";
}

export async function nextTraceCode(prisma: PrismaClient, names: NameParts) {
  return prisma.$transaction(async (tx) => {
    const facility = await tx.facility.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    const updated = await tx.facility.update({
      where: { id: facility.id },
      data: { traceSequence: { increment: 1 } }
    });

    const initials = buildInitials(names);
    return {
      facilityId: facility.id,
      traceSequence: updated.traceSequence,
      traceCode: `${initials}${updated.traceSequence}`,
      initials
    };
  });
}

export async function resolvePatientTraceCode(
  prisma: PrismaClient,
  names: NameParts,
  manualTraceCode?: string,
  currentPatientId?: string,
) {
  const normalizedManualTraceCode = manualTraceCode
    ?.trim()
    .toUpperCase()
    .replace(/\s+/gu, "");

  if (!normalizedManualTraceCode) {
    return nextTraceCode(prisma, names);
  }

  const match = normalizedManualTraceCode.match(/^([A-Z]{2,3})(\d+)$/u);
  if (!match) {
    throw new Error(
      "Trace code must use 2-3 initials followed by digits, for example ML1205.",
    );
  }

  const initials = match[1] ?? buildInitials(names);
  const sequenceValue = match[2];
  const traceSequence = Number(sequenceValue);
  if (!Number.isSafeInteger(traceSequence) || traceSequence <= 0) {
    throw new Error("Trace code sequence must be a positive whole number.");
  }

  return prisma.$transaction(async (tx) => {
    const facility = await tx.facility.findFirstOrThrow({
      orderBy: { createdAt: "asc" },
    });
    const existing = await tx.patient.findUnique({
      where: { traceCode: normalizedManualTraceCode },
      select: { id: true },
    });

    if (existing && existing.id !== currentPatientId) {
      throw new Error(`Trace code ${normalizedManualTraceCode} already exists.`);
    }

    if (traceSequence > facility.traceSequence) {
      await tx.facility.update({
        where: { id: facility.id },
        data: { traceSequence },
      });
    }

    return {
      facilityId: facility.id,
      traceSequence,
      traceCode: normalizedManualTraceCode,
      initials,
    };
  });
}

export function buildAccessionNumber() {
  return `NX-${Date.now().toString(36).toUpperCase()}`;
}

export function buildSampleLabel(traceCode: string, department: string) {
  const date = new Date().toLocaleDateString("en-GB");
  return `${traceCode} - ${department} - ${date}`;
}
