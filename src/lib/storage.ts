import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";

const KEY_RE = /^[a-f0-9]{32}$/;

export function resolveUploadRoot(uploadPath: string) {
  return path.resolve(uploadPath);
}

export function storedFilePath(uploadPath: string, storageKey: string) {
  if (!KEY_RE.test(storageKey)) {
    throw new Error("Invalid storage key");
  }
  const root = resolveUploadRoot(uploadPath);
  const full = path.join(root, storageKey);
  if (!full.startsWith(root + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return full;
}

export async function writeStoredFile(uploadPath: string, bytes: Buffer) {
  const key = randomBytes(16).toString("hex");
  const root = resolveUploadRoot(uploadPath);
  await mkdir(root, { recursive: true });
  await writeFile(storedFilePath(uploadPath, key), bytes);
  return key;
}

export async function removeStoredFile(uploadPath: string, storageKey: string | null) {
  if (!storageKey) return;
  await unlink(storedFilePath(uploadPath, storageKey)).catch(() => undefined);
}

export function readStoredFile(uploadPath: string, storageKey: string) {
  return Readable.toWeb(createReadStream(storedFilePath(uploadPath, storageKey))) as ReadableStream;
}
