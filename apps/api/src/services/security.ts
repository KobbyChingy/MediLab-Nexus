import { roleCapabilities, userRoles, type Capability } from "@medilab/shared";
import type { PrismaClient } from "@medilab/db";
import type { FastifyRequest } from "fastify";
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export type ActorContext = {
  id: string;
  facilityId: string;
  username: string;
  displayName: string;
  role: (typeof userRoles)[number];
  allowedActions: Capability[];
  authenticated: boolean;
};

export function buildActorContext(user: {
  id: string;
  facilityId: string;
  username: string;
  displayName: string;
  role: (typeof userRoles)[number];
}): ActorContext {
  return {
    id: user.id,
    facilityId: user.facilityId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    allowedActions: roleCapabilities[user.role],
    authenticated: true,
  };
}

export function getAnonymousActor(): ActorContext {
  return {
    id: "anonymous",
    facilityId: "",
    username: "anonymous",
    displayName: "Unauthenticated",
    role: "RECEPTION",
    allowedActions: [],
    authenticated: false,
  };
}

export function hashPin(pin: string, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(pin, salt, 64).toString("hex");
  return { salt, hash: derived };
}

export function verifyPin(pin: string, salt: string, expectedHash: string) {
  const derived = scryptSync(pin, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return (
    derived.length === expected.length && timingSafeEqual(derived, expected)
  );
}

export function hashSessionToken(sessionToken: string) {
  return createHash("sha256").update(sessionToken).digest("hex");
}

function readCookieValue(cookieHeader: string, cookieName: string) {
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === cookieName) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

export function getRequestSessionToken(request: FastifyRequest) {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== "string" || !cookieHeader) {
    return null;
  }

  const cookieName =
    process.env.MEDILAB_SESSION_COOKIE_NAME ?? "medilab_session";
  return readCookieValue(cookieHeader, cookieName);
}

export async function resolveActorContext(
  prisma: PrismaClient,
  request: FastifyRequest,
) {
  const sessionToken = getRequestSessionToken(request);

  if (!sessionToken) {
    return getAnonymousActor();
  }

  const session = await prisma.appSession.findUnique({
    where: { tokenHash: hashSessionToken(sessionToken) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    return getAnonymousActor();
  }

  await prisma.appSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });
  return buildActorContext({
    id: session.user.id,
    facilityId: session.user.facilityId,
    username: session.user.username,
    displayName: session.user.displayName,
    role: session.user.role,
  });
}

export function hasCapability(actor: ActorContext, capability: Capability) {
  return actor.allowedActions.includes(capability);
}

function getKey() {
  const secret =
    process.env.MEDILAB_ENCRYPTION_KEY ?? "medilab-nexus-local-dev-key";
  return createHash("sha256").update(secret).digest();
}

export function encryptText(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptText(cipherText: string) {
  const [iv, tag, encrypted] = cipherText.split(".");
  if (!iv || !tag || !encrypted) {
    throw new Error("Encrypted payload is malformed.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
