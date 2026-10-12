import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { COOKIE_NAME, SESSION_DAYS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

function hashToken(token: string, secret: string) {
  return createHmac("sha256", secret).update(token).digest("hex");
}

async function cookieSecure() {
  const headerStore = await headers();
  return headerStore.get("x-forwarded-proto") === "https";
}

export async function createSession(userId: string) {
  const settings = await getSettings();
  if (!settings.sessionSecret) {
    throw new Error("Cove is not set up yet.");
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token, settings.sessionSecret),
      expiresAt,
    },
  });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    const settings = await getSettings();
    if (settings.sessionSecret) {
      await prisma.session.deleteMany({
        where: { tokenHash: hashToken(token, settings.sessionSecret) },
      });
    }
  }
  jar.delete(COOKIE_NAME);
}

export const getCurrentUserOptional = cache(async (): Promise<PublicUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const settings = await getSettings();
  if (!settings.sessionSecret) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token, settings.sessionSecret) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now() || session.user.disabled) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
});
