"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { INVITE_DAYS, DEFAULT_UPLOAD_PATH } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { createSession, clearSession } from "@/lib/auth";
import { boot } from "@/lib/guards";
import { hashPassword, verifyPassword } from "@/lib/password";
import { newSessionSecret, getSettings } from "@/lib/settings";
import { createUserWithRoot } from "@/lib/users";
import type { ActionState } from "@/lib/action-state";
import {
  cleanEmail,
  cleanPassword,
  cleanPersonName,
  cleanRegistrationMode,
  cleanSiteName,
  quotaBytesFromGb,
  uploadBytesFromMb,
} from "@/lib/validate";

export async function logout() {
  await clearSession();
  redirect("/login");
}

export async function completeSetup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await boot();
  if (gate.state === "db") return { error: "Postgres isn't reachable." };
  if (gate.state === "ready") redirect("/drive");

  const siteName = cleanSiteName(formData.get("siteName"));
  const name = cleanPersonName(formData.get("name"));
  const email = cleanEmail(formData.get("email"));
  const password = cleanPassword(formData.get("password"));
  const registrationMode = cleanRegistrationMode(formData.get("registrationMode"));
  const quota = quotaBytesFromGb(formData.get("quotaGb"));
  const upload = uploadBytesFromMb(formData.get("uploadMb"));
  if (!siteName || !name || !email || !password || !registrationMode || quota === null || upload === null) {
    return { error: "Check each field and try again." };
  }
  if (password !== String(formData.get("confirm") ?? "")) {
    return { error: "Those passwords don't match." };
  }

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.setting.findUnique({ where: { key: "setupComplete" } });
      if (existing?.value === true) throw new Error("SETUP_DONE");
      const entries: Record<string, string | number | boolean> = {
        setupComplete: true,
        siteName,
        registrationMode,
        defaultQuotaBytes: quota,
        maxUploadBytes: upload,
        uploadPath: DEFAULT_UPLOAD_PATH,
        sessionSecret: newSessionSecret(),
      };
      for (const [key, value] of Object.entries(entries)) {
        await tx.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });
      }
      const created = await tx.user.create({
        data: { email, name, passwordHash, role: "ADMIN" },
      });
      await tx.item.create({
        data: { name: "My Drive", kind: "FOLDER", ownerId: created.id },
      });
      return created;
    });
    await createSession(user.id);
  } catch (error) {
    unstable_rethrow(error);
    const settings = await getSettings().catch(() => null);
    if (settings?.setupComplete || (error instanceof Error && error.message === "SETUP_DONE")) {
      redirect("/login");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That email is already in use." };
    }
    return { error: "Setup couldn't be finished." };
  }
  redirect("/drive");
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await boot();
  if (gate.state === "db") return { error: "Postgres isn't reachable." };
  if (gate.state === "setup") redirect("/setup");
  const email = cleanEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const user = await prisma.user.findUnique({ where: { email } });
  const matches = user ? await verifyPassword(user.passwordHash, password) : false;
  if (!user || user.disabled || !matches) {
    return { error: "Email or password doesn't match." };
  }
  await createSession(user.id);
  redirect("/drive");
}

async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  inviteToken?: string;
}) {
  const gate = await boot();
  if (gate.state === "db") return { error: "Postgres isn't reachable." } satisfies ActionState;
  if (gate.state === "setup") redirect("/setup");
  if (gate.user) redirect("/drive");

  if (input.inviteToken) {
    if (gate.settings.registrationMode === "closed") {
      return { error: "Invites are turned off." };
    }
    const invite = await prisma.invite.findUnique({ where: { token: input.inviteToken } });
    if (!invite || invite.usedAt || (invite.expiresAt && invite.expiresAt.getTime() < Date.now())) {
      return { error: "This invite is no longer valid." };
    }
    if (invite.email && invite.email !== input.email) {
      return { error: "Use the email address this invite was made for." };
    }
    try {
      const user = await createUserWithRoot({
        email: input.email,
        name: input.name,
        password: input.password,
        role: "USER",
      });
      await prisma.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
      await createSession(user.id);
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { error: "An account with that email already exists." };
      }
      return { error: "The account couldn't be created." };
    }
    redirect("/drive");
  }

  if (gate.settings.registrationMode !== "open") {
    return { error: "New accounts are created by an admin." };
  }
  try {
    const user = await createUserWithRoot({
      email: input.email,
      name: input.name,
      password: input.password,
      role: "USER",
    });
    await createSession(user.id);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An account with that email already exists." };
    }
    return { error: "The account couldn't be created." };
  }
  redirect("/drive");
}

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = cleanPersonName(formData.get("name"));
  const email = cleanEmail(formData.get("email"));
  const password = cleanPassword(formData.get("password"));
  if (!name || !email || !password) return { error: "Enter a name, email, and a password of at least 8 characters." };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Those passwords don't match." };
  const inviteToken = String(formData.get("invite") ?? "").trim();
  return registerAccount({ name, email, password, inviteToken: inviteToken || undefined });
}

export async function createInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await boot();
  if (gate.state !== "ready" || gate.user?.role !== "ADMIN") return { error: "Admins create invites." };
  const emailValue = String(formData.get("email") ?? "").trim();
  const email = emailValue ? cleanEmail(emailValue) : null;
  if (emailValue && !email) return { error: "That email doesn't look right." };
  await prisma.invite.create({
    data: {
      token: randomBytes(24).toString("base64url"),
      email,
      createdById: gate.user.id,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return { ok: true };
}

export async function revokeInvite(formData: FormData) {
  const gate = await boot();
  if (gate.state !== "ready" || gate.user?.role !== "ADMIN") redirect("/login");
  await prisma.invite.deleteMany({
    where: { id: String(formData.get("id") ?? ""), usedAt: null },
  });
  redirect("/admin/settings");
}
