import { GB, MB } from "@/lib/constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return null;
  return email;
}

export function cleanPersonName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 80) return null;
  return name;
}

export function cleanSiteName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 60) return null;
  return name;
}

export function cleanItemName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 200) return null;
  return name;
}

export function cleanPassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 8 || value.length > 200) return null;
  return value;
}

export type RegistrationMode = "closed" | "open" | "invite";

export function cleanRegistrationMode(value: unknown): RegistrationMode | null {
  if (value === "closed" || value === "open" || value === "invite") return value;
  return null;
}

export function quotaBytesFromGb(value: unknown): number | null {
  const gb = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(gb) || gb <= 0 || gb > 10000) return null;
  return Math.round(gb * GB);
}

export function uploadBytesFromMb(value: unknown): number | null {
  const mb = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(mb) || mb < 1 || mb > 2048) return null;
  return Math.round(mb * MB);
}

export function optionalQuotaBytes(value: unknown): bigint | null | undefined {
  if (typeof value !== "string" || value.trim() === "") return null;
  const bytes = quotaBytesFromGb(value);
  if (bytes === null) return undefined;
  return BigInt(bytes);
}
