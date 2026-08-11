import type { PrismaClient } from "@medilab/db";
import type {
  AttendanceSettingsInput,
  AttendanceSettingsPayload,
  AttendanceWorkspacePayload,
} from "@medilab/shared";

const attendanceDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const attendanceDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Accra",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getTodayAttendanceDate() {
  return attendanceDateFormatter.format(new Date());
}

function getAttendanceDateFromTimestamp(value: Date) {
  return attendanceDateFormatter.format(value);
}

function normalizeAttendanceDate(value?: string | null) {
  return value && attendanceDatePattern.test(value)
    ? value
    : getTodayAttendanceDate();
}

function parseJsonArray(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeAttendanceSettings(
  value:
    | AttendanceSettingsInput
    | {
        offDaysJson?: string | null;
        holidaysJson?: string | null;
      }
    | null
    | undefined,
): AttendanceSettingsPayload {
  const rawOffDays = Array.isArray((value as AttendanceSettingsInput | null)?.offDays)
    ? (value as AttendanceSettingsInput).offDays
    : parseJsonArray(value?.offDaysJson);
  const rawHolidays = Array.isArray(
    (value as AttendanceSettingsInput | null)?.holidays,
  )
    ? (value as AttendanceSettingsInput).holidays
    : parseJsonArray(value?.holidaysJson);

  const offDays = Array.from(
    new Set(
      (Array.isArray(rawOffDays) ? rawOffDays : [])
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ).sort((left, right) => left - right);

  const holidayMap = new Map<string, string>();
  for (const entry of Array.isArray(rawHolidays) ? rawHolidays : []) {
    const date =
      typeof entry?.date === "string" && attendanceDatePattern.test(entry.date)
        ? entry.date
        : "";
    const label = typeof entry?.label === "string" ? entry.label.trim() : "";
    if (!date || label.length < 2) {
      continue;
    }
    holidayMap.set(date, label);
  }

  return {
    offDays,
    holidays: Array.from(holidayMap.entries())
      .map(([date, label]) => ({ date, label }))
      .sort((left, right) => left.date.localeCompare(right.date)),
  };
}

async function readAttendanceSettings(
  prisma: PrismaClient,
  facilityId: string,
) {
  const settings = await prisma.attendanceSettings.findUnique({
    where: { facilityId },
  });

  return normalizeAttendanceSettings(settings);
}

export async function saveAttendanceSettings(
  prisma: PrismaClient,
  facilityId: string,
  input: AttendanceSettingsInput,
) {
  const normalized = normalizeAttendanceSettings(input);

  await prisma.attendanceSettings.upsert({
    where: { facilityId },
    update: {
      offDaysJson: JSON.stringify(normalized.offDays),
      holidaysJson: JSON.stringify(normalized.holidays),
    },
    create: {
      facilityId,
      offDaysJson: JSON.stringify(normalized.offDays),
      holidaysJson: JSON.stringify(normalized.holidays),
    },
  });

  return normalized;
}

export async function recordAttendanceLogin(
  prisma: PrismaClient,
  input: { facilityId: string; userId: string },
  occurredAt = new Date(),
) {
  const attendanceDate = getAttendanceDateFromTimestamp(occurredAt);
  const existing = await prisma.attendanceRecord.findUnique({
    where: {
      facilityId_userId_attendanceDate: {
        facilityId: input.facilityId,
        userId: input.userId,
        attendanceDate,
      },
    },
  });

  if (existing) {
    return prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        lastActivityAt: occurredAt,
        lastLogoutAt: null,
        status: "OPEN",
      },
    });
  }

  return prisma.attendanceRecord.create({
    data: {
      facilityId: input.facilityId,
      userId: input.userId,
      attendanceDate,
      firstLoginAt: occurredAt,
      lastActivityAt: occurredAt,
      status: "OPEN",
    },
  });
}

export async function recordAttendanceLogout(
  prisma: PrismaClient,
  input: { facilityId: string; userId: string },
  occurredAt = new Date(),
) {
  const attendanceDate = getAttendanceDateFromTimestamp(occurredAt);
  const existing = await prisma.attendanceRecord.findUnique({
    where: {
      facilityId_userId_attendanceDate: {
        facilityId: input.facilityId,
        userId: input.userId,
        attendanceDate,
      },
    },
  });

  if (existing) {
    return prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        lastActivityAt: occurredAt,
        lastLogoutAt: occurredAt,
        status: "CLOSED",
      },
    });
  }

  return prisma.attendanceRecord.create({
    data: {
      facilityId: input.facilityId,
      userId: input.userId,
      attendanceDate,
      firstLoginAt: occurredAt,
      lastActivityAt: occurredAt,
      lastLogoutAt: occurredAt,
      status: "CLOSED",
    },
  });
}

export async function buildAttendanceWorkspace(
  prisma: PrismaClient,
  facilityId: string,
  requestedDate?: string | null,
): Promise<AttendanceWorkspacePayload> {
  const attendanceDate = normalizeAttendanceDate(requestedDate);
  const [settings, users, records] = await Promise.all([
    readAttendanceSettings(prisma, facilityId),
    prisma.appUser.findMany({
      where: {
        facilityId,
        isActive: true,
      },
      orderBy: [{ role: "asc" }, { displayName: "asc" }],
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        facilityId,
        attendanceDate,
      },
      select: {
        userId: true,
        firstLoginAt: true,
        lastActivityAt: true,
        lastLogoutAt: true,
        status: true,
      },
    }),
  ]);

  const holidayMap = new Map(
    settings.holidays.map((holiday) => [holiday.date, holiday.label]),
  );
  const holidayLabel = holidayMap.get(attendanceDate) ?? null;
  const weekday = new Date(`${attendanceDate}T00:00:00.000Z`).getUTCDay();
  const isOffDay = settings.offDays.includes(weekday);
  const recordMap = new Map(records.map((record) => [record.userId, record]));

  const entries = users.map((user) => {
    const record = recordMap.get(user.id);
    if (record) {
      const status = record.lastLogoutAt || record.status === "CLOSED"
        ? "CLOSED"
        : "PRESENT";

      return {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        status,
        holidayLabel: null,
        firstLoginAt: record.firstLoginAt.toISOString(),
        lastActivityAt: record.lastActivityAt.toISOString(),
        lastLogoutAt: record.lastLogoutAt?.toISOString() ?? null,
      } satisfies AttendanceWorkspacePayload["entries"][number];
    }

    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: holidayLabel ? "HOLIDAY" : isOffDay ? "OFF_DAY" : "ABSENT",
      holidayLabel,
      firstLoginAt: null,
      lastActivityAt: null,
      lastLogoutAt: null,
    } satisfies AttendanceWorkspacePayload["entries"][number];
  });

  return {
    date: attendanceDate,
    generatedAt: new Date().toISOString(),
    settings,
    summary: {
      presentCount: entries.filter((entry) => entry.status === "PRESENT").length,
      closedCount: entries.filter((entry) => entry.status === "CLOSED").length,
      absentCount: entries.filter((entry) => entry.status === "ABSENT").length,
      offDayCount: entries.filter((entry) => entry.status === "OFF_DAY").length,
      holidayCount: entries.filter((entry) => entry.status === "HOLIDAY").length,
    },
    entries,
  };
}