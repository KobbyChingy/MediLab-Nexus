import type { PrismaClient } from "@medilab/db";
import { randomBytes } from "node:crypto";
import {
  buildActorContext,
  hashPin,
  hashSessionToken,
  verifyPin,
} from "./security.js";

const sessionTtlMs = 1000 * 60 * 60 * 12;
const lockoutThreshold = 5;
const lockoutMs = 1000 * 60 * 15;

export type LoginResult =
  | {
      status: "success";
      sessionToken: string;
      expiresAt: Date;
      user: ReturnType<typeof buildActorContext>;
    }
  | {
      status: "locked";
      lockedUntil: Date;
      displayName: string;
    }
  | {
      status: "invalid";
    };

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

async function findUserForLogin(prisma: PrismaClient, username: string) {
  const normalizedUsername = normalizeUsername(username);
  const exactMatch = await prisma.appUser.findUnique({
    where: { username: normalizedUsername },
  });

  if (exactMatch) {
    return {
      normalizedUsername,
      user: exactMatch,
      requiresNormalization: false,
    };
  }

  const legacyMatches = await prisma.appUser.findMany({
    where: {
      username: {
        equals: normalizedUsername,
        mode: "insensitive",
      },
    },
    orderBy: [{ createdAt: "asc" }],
    take: 2,
  });

  if (legacyMatches.length !== 1) {
    return {
      normalizedUsername,
      user: null,
      requiresNormalization: false,
    };
  }

  return {
    normalizedUsername,
    user: legacyMatches[0],
    requiresNormalization: legacyMatches[0].username !== normalizedUsername,
  };
}

export async function loginWithPin(
  prisma: PrismaClient,
  username: string,
  pin: string,
) {
  const { normalizedUsername, user, requiresNormalization } =
    await findUserForLogin(prisma, username);

  if (!user || !user.isActive) {
    return { status: "invalid" } satisfies LoginResult;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      status: "locked",
      lockedUntil: user.lockedUntil,
      displayName: user.displayName,
    } satisfies LoginResult;
  }

  if (!verifyPin(pin, user.pinSalt, user.pinHash)) {
    const failedLoginCount = user.failedLoginCount + 1;
    const lockedUntil =
      failedLoginCount >= lockoutThreshold
        ? new Date(Date.now() + lockoutMs)
        : null;

    await prisma.appUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil,
      },
    });

    if (lockedUntil) {
      return {
        status: "locked",
        lockedUntil,
        displayName: user.displayName,
      } satisfies LoginResult;
    }

    return { status: "invalid" } satisfies LoginResult;
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlMs);

  await prisma.appSession.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt,
    },
  });

  await prisma.appUser.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  if (requiresNormalization) {
    try {
      await prisma.appUser.update({
        where: { id: user.id },
        data: { username: normalizedUsername },
      });
      user.username = normalizedUsername;
    } catch {
      // Leave the legacy username in place if a conflicting normalized account exists.
    }
  }

  return {
    status: "success",
    sessionToken,
    expiresAt,
    user: buildActorContext({
      id: user.id,
      facilityId: user.facilityId,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    }),
  } satisfies LoginResult;
}

export async function getSessionFromToken(
  prisma: PrismaClient,
  sessionToken: string,
) {
  const session = await prisma.appSession.findUnique({
    where: { tokenHash: hashSessionToken(sessionToken) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    return null;
  }

  return {
    sessionToken,
    expiresAt: session.expiresAt,
    user: buildActorContext({
      id: session.user.id,
      facilityId: session.user.facilityId,
      username: session.user.username,
      displayName: session.user.displayName,
      role: session.user.role,
    }),
  };
}

export async function logoutSession(
  prisma: PrismaClient,
  sessionToken: string,
) {
  await prisma.appSession.deleteMany({
    where: { tokenHash: hashSessionToken(sessionToken) },
  });
}

export async function purgeExpiredSessions(prisma: PrismaClient) {
  await prisma.appSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

export async function listLocalUsers(prisma: PrismaClient) {
  const users = await prisma.appUser.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
  });
  return users.map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    failedLoginCount: user.failedLoginCount,
    lockedUntil: user.lockedUntil,
    lastLoginAt: user.lastLoginAt,
    pinChangedAt: user.pinChangedAt,
    createdAt: user.createdAt,
  }));
}

export async function createLocalUser(
  prisma: PrismaClient,
  input: {
    facilityId: string;
    username: string;
    displayName: string;
    role: Parameters<typeof buildActorContext>[0]["role"];
    pin: string;
  },
) {
  const normalizedUsername = normalizeUsername(input.username);
  const displayName = input.displayName.trim();
  const { salt, hash } = hashPin(
    input.pin,
    `${input.facilityId}-${normalizedUsername}-${Date.now()}`,
  );

  return prisma.appUser.create({
    data: {
      facilityId: input.facilityId,
      username: normalizedUsername,
      displayName,
      role: input.role,
      pinSalt: salt,
      pinHash: hash,
      pinChangedAt: new Date(),
    },
  });
}

export async function rotateUserPin(
  prisma: PrismaClient,
  userId: string,
  newPin: string,
) {
  const user = await prisma.appUser.findUniqueOrThrow({
    where: { id: userId },
  });
  const { salt, hash } = hashPin(
    newPin,
    `${user.facilityId}-${user.username}-${Date.now()}`,
  );

  await prisma.$transaction(async (tx) => {
    await tx.appUser.update({
      where: { id: userId },
      data: {
        pinSalt: salt,
        pinHash: hash,
        pinChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await tx.appSession.deleteMany({ where: { userId } });
  });

  return prisma.appUser.findUniqueOrThrow({ where: { id: userId } });
}

export async function changeOwnPin(
  prisma: PrismaClient,
  userId: string,
  currentPin: string,
  newPin: string,
) {
  const user = await prisma.appUser.findUniqueOrThrow({
    where: { id: userId },
  });

  if (!verifyPin(currentPin, user.pinSalt, user.pinHash)) {
    throw new Error("Current PIN is incorrect.");
  }

  return rotateUserPin(prisma, userId, newPin);
}

export async function setUserActiveState(
  prisma: PrismaClient,
  userId: string,
  isActive: boolean,
) {
  await prisma.$transaction(async (tx) => {
    await tx.appUser.update({
      where: { id: userId },
      data: { isActive, failedLoginCount: 0, lockedUntil: null },
    });
    if (!isActive) {
      await tx.appSession.deleteMany({ where: { userId } });
    }
  });

  return prisma.appUser.findUniqueOrThrow({ where: { id: userId } });
}

export async function unlockUser(prisma: PrismaClient, userId: string) {
  return prisma.appUser.update({
    where: { id: userId },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
}
