import "server-only";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserOptional, type PublicUser } from "@/lib/auth";
import { getSettings, type AppSettings } from "@/lib/settings";

export type Gate =
  | { state: "db" }
  | { state: "setup"; settings: AppSettings }
  | { state: "ready"; settings: AppSettings; user: PublicUser | null };

export async function boot(): Promise<Gate> {
  await connection();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return { state: "db" };
  }
  const settings = await getSettings();
  if (!settings.setupComplete) return { state: "setup", settings };
  const user = await getCurrentUserOptional();
  return { state: "ready", settings, user };
}
