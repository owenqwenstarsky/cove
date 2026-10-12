import "server-only";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getSettings } from "@/lib/settings";

export async function createUserWithRoot(input: {
  email: string;
  name: string;
  password: string;
  role: Role;
  quotaBytes?: bigint | null;
}) {
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        role: input.role,
        quotaBytes: input.quotaBytes ?? null,
      },
    });
    await tx.item.create({
      data: { name: "My Drive", kind: "FOLDER", ownerId: user.id },
    });
    return user;
  });
}

export async function ensureRoot(userId: string) {
  const existing = await prisma.item.findFirst({
    where: { ownerId: userId, parentId: null, kind: "FOLDER" },
  });
  if (existing) return existing;
  return prisma.item.create({
    data: { name: "My Drive", kind: "FOLDER", ownerId: userId },
  });
}

export async function storageUsed(ownerId: string) {
  const total = await prisma.item.aggregate({
    where: { ownerId },
    _sum: { sizeBytes: true },
  });
  return total._sum.sizeBytes ?? BigInt(0);
}

export async function quotaFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { quotaBytes: true },
  });
  const settings = await getSettings();
  return {
    quota: user.quotaBytes ?? BigInt(settings.defaultQuotaBytes),
    used: await storageUsed(userId),
  };
}

export async function assertStorage(ownerId: string, additional: bigint) {
  if (additional <= BigInt(0)) return;
  const { quota, used } = await quotaFor(ownerId);
  if (used + additional > quota) {
    throw new Error("This account is out of storage.");
  }
}

export async function countOtherActiveAdmins(userId: string) {
  return prisma.user.count({
    where: { role: "ADMIN", disabled: false, id: { not: userId } },
  });
}
