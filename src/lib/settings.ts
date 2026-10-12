import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_QUOTA_BYTES,
  DEFAULT_UPLOAD_PATH,
} from "@/lib/constants";
import type { RegistrationMode } from "@/lib/validate";

export type AppSettings = {
  setupComplete: boolean;
  siteName: string;
  registrationMode: RegistrationMode;
  defaultQuotaBytes: number;
  maxUploadBytes: number;
  uploadPath: string;
  sessionSecret: string;
};

const FALLBACK: AppSettings = {
  setupComplete: false,
  siteName: "Cove",
  registrationMode: "closed",
  defaultQuotaBytes: DEFAULT_QUOTA_BYTES,
  maxUploadBytes: DEFAULT_MAX_UPLOAD_BYTES,
  uploadPath: DEFAULT_UPLOAD_PATH,
  sessionSecret: "",
};

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function mode(value: unknown): RegistrationMode {
  if (value === "open" || value === "invite" || value === "closed") return value;
  return "closed";
}

function positive(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    setupComplete: map.get("setupComplete") === true,
    siteName: text(map.get("siteName"), FALLBACK.siteName),
    registrationMode: mode(map.get("registrationMode")),
    defaultQuotaBytes: positive(map.get("defaultQuotaBytes"), FALLBACK.defaultQuotaBytes),
    maxUploadBytes: positive(map.get("maxUploadBytes"), FALLBACK.maxUploadBytes),
    uploadPath: text(map.get("uploadPath"), FALLBACK.uploadPath),
    sessionSecret: text(map.get("sessionSecret"), ""),
  };
}

export async function writeSettings(values: Record<string, unknown>) {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: value as never },
        update: { value: value as never },
      }),
    ),
  );
}

export function newSessionSecret() {
  return randomBytes(32).toString("base64url");
}
