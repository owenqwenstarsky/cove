import "server-only";
import { prisma } from "@/lib/db";

export async function findOpenInvite(token: string) {
  return prisma.invite.findFirst({
    where: {
      token,
      usedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
}
