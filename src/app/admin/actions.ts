"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { ActionState } from "@/lib/action-state";
import { boot } from "@/lib/guards";
import { hashPassword } from "@/lib/password";
import { writeSettings } from "@/lib/settings";
import { countOtherActiveAdmins, createUserWithRoot } from "@/lib/users";
import { prisma } from "@/lib/db";
import {
  cleanEmail,
  cleanPassword,
  cleanPersonName,
  cleanRegistrationMode,
  cleanSiteName,
  optionalQuotaBytes,
  quotaBytesFromGb,
  uploadBytesFromMb,
} from "@/lib/validate";

async function admin() {
  const gate = await boot();
  if (gate.state === "setup") redirect("/setup");
  if (gate.state !== "ready" || gate.user?.role !== "ADMIN") redirect("/login");
  return gate.user;
}

export async function createAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await admin();
  const name = cleanPersonName(formData.get("name"));
  const email = cleanEmail(formData.get("email"));
  const password = cleanPassword(formData.get("password"));
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "USER";
  const quota = optionalQuotaBytes(formData.get("quotaGb"));
  if (!name || !email || !password) return { error: "Name, email, and a password of at least 8 characters are required." };
  if (quota === undefined) return { error: "Leave quota blank or enter gigabytes." };
  try {
    await createUserWithRoot({ email, name, password, role, quotaBytes: quota });
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An account with that email already exists." };
    }
    console.error(error);
    return { error: "The account couldn't be created." };
  }
}

export async function updateAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await admin();
  const id = String(formData.get("id") ?? "");
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "USER";
  const disabled = formData.get("disabled") === "on";
  const quota = optionalQuotaBytes(formData.get("quotaGb"));
  if (quota === undefined) return { error: "Leave quota blank or enter gigabytes." };
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "That account no longer exists." };
  const demoting = target.role === "ADMIN" && !target.disabled && (role !== "ADMIN" || disabled);
  if (demoting && (await countOtherActiveAdmins(target.id)) === 0) {
    return { error: "Cove needs at least one active admin." };
  }
  const passwordRaw = String(formData.get("password") ?? "");
  let passwordHash: string | undefined;
  if (passwordRaw) {
    const password = cleanPassword(passwordRaw);
    if (!password) return { error: "New passwords need at least 8 characters." };
    passwordHash = await hashPassword(password);
  }
  if (actor.id === target.id && disabled) return { error: "Ask another admin to disable your account." };
  await prisma.user.update({
    where: { id },
    data: {
      role,
      disabled,
      quotaBytes: quota,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });
  if (actor.id === target.id && role !== "ADMIN") redirect("/drive");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function saveSiteSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await admin();
  const siteName = cleanSiteName(formData.get("siteName"));
  const registrationMode = cleanRegistrationMode(formData.get("registrationMode"));
  const quota = quotaBytesFromGb(formData.get("quotaGb"));
  const upload = uploadBytesFromMb(formData.get("uploadMb"));
  if (!siteName || !registrationMode || quota === null || upload === null) {
    return { error: "Check the site settings and try again." };
  }
  await writeSettings({
    siteName,
    registrationMode,
    defaultQuotaBytes: quota,
    maxUploadBytes: upload,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
