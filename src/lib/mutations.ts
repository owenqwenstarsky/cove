import "server-only";
import { randomBytes } from "node:crypto";
import type { ItemKind, Permission, Prisma } from "@prisma/client";
import { EDITOR_JSON_LIMIT } from "@/lib/constants";
import { emptyDoc, emptySheet, emptySlides } from "@/lib/content";
import { prisma } from "@/lib/db";
import { inspectItem, inspectLink, combinedAccess } from "@/lib/access";
import { canEdit, canView } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { removeStoredFile, writeStoredFile } from "@/lib/storage";
import { assertStorage, ensureRoot } from "@/lib/users";
import { cleanItemName } from "@/lib/validate";

export class UserError extends Error {}

function jsonPayload(value: unknown) {
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new UserError("That file couldn't be saved.");
  }
  if (!encoded || encoded.length > EDITOR_JSON_LIMIT) {
    throw new UserError("This file is too large to save.");
  }
  return { content: JSON.parse(encoded) as Prisma.InputJsonValue, size: BigInt(Buffer.byteLength(encoded)) };
}

async function editableFolder(userId: string, folderId: string) {
  const inspected = await inspectItem(userId, folderId);
  if (!inspected || inspected.item.kind !== "FOLDER" || inspected.trashed || !canEdit(inspected.access)) {
    throw new UserError("Choose a folder you can edit.");
  }
  return inspected;
}

export async function createEntry(
  userId: string,
  parentId: string,
  kind: Exclude<ItemKind, "FILE">,
  requestedName?: string,
) {
  const parent = await editableFolder(userId, parentId);
  const fallback =
    kind === "FOLDER"
      ? "New folder"
      : kind === "DOCUMENT"
        ? "Untitled document"
        : kind === "SPREADSHEET"
          ? "Untitled spreadsheet"
          : "Untitled presentation";
  const name = requestedName ? cleanItemName(requestedName) : fallback;
  if (!name) throw new UserError("Enter a name.");
  const content = kind === "DOCUMENT" ? emptyDoc : kind === "SPREADSHEET" ? emptySheet() : kind === "PRESENTATION" ? emptySlides() : null;
  const payload = content ? jsonPayload(content) : { content: null, size: BigInt(0) };
  await assertStorage(parent.item.ownerId, payload.size);
  return prisma.item.create({
    data: {
      name,
      kind,
      parentId,
      ownerId: parent.item.ownerId,
      sizeBytes: payload.size,
      document: kind === "DOCUMENT" ? { create: { content: payload.content! } } : undefined,
      spreadsheet: kind === "SPREADSHEET" ? { create: { content: payload.content! } } : undefined,
      presentation: kind === "PRESENTATION" ? { create: { content: payload.content! } } : undefined,
    },
  });
}

export async function createUploadedFile(input: {
  userId: string;
  parentId: string;
  name: string;
  mimeType: string;
  bytes: Buffer;
  linkToken?: string | null;
}) {
  const name = cleanItemName(input.name);
  if (!name) throw new UserError("Choose a file with a name.");
  const settings = await getSettings();
  if (input.bytes.byteLength > settings.maxUploadBytes) {
    throw new UserError("That file is larger than the upload limit.");
  }
  const ownerId = input.linkToken
    ? (await linkFolder(input.linkToken, input.parentId)).ownerId
    : (await editableFolder(input.userId, input.parentId)).item.ownerId;
  await assertStorage(ownerId, BigInt(input.bytes.byteLength));
  const storageKey = await writeStoredFile(settings.uploadPath, input.bytes);
  try {
    return await prisma.item.create({
      data: {
        name,
        kind: "FILE",
        parentId: input.parentId,
        ownerId,
        sizeBytes: BigInt(input.bytes.byteLength),
        mimeType: input.mimeType || "application/octet-stream",
        storageKey,
      },
    });
  } catch (error) {
    await removeStoredFile(settings.uploadPath, storageKey);
    throw error;
  }
}

async function linkFolder(token: string, folderId: string) {
  const linked = await inspectLink(token, folderId);
  if (!linked || linked.trashed || linked.item.kind !== "FOLDER" || linked.access.level !== "edit") {
    throw new UserError("Choose a folder you can edit.");
  }
  return { ownerId: linked.item.ownerId, access: linked.access };
}

export async function renameOwnedOrEditable(userId: string, itemId: string, name: string) {
  const clean = cleanItemName(name);
  if (!clean) throw new UserError("Enter a file name.");
  const inspected = await inspectItem(userId, itemId);
  if (!inspected || inspected.trashed || !canEdit(inspected.access)) {
    throw new UserError("You can't rename that file.");
  }
  if (!inspected.item.parentId) throw new UserError("The home folder keeps its name.");
  await prisma.item.update({ where: { id: itemId }, data: { name: clean } });
}

export async function moveOwned(userId: string, itemId: string, destinationId: string) {
  const inspected = await inspectItem(userId, itemId);
  if (!inspected || !inspected.access.isOwner || !inspected.item.parentId) {
    throw new UserError("Only the owner can move that.");
  }
  const destination = await editableFolder(userId, destinationId);
  if (destination.item.id === inspected.item.parentId) return;
  let cursor: string | null = destination.item.id;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === inspected.item.id) throw new UserError("A folder can't be moved into itself.");
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const parent: { parentId: string | null } | null = await prisma.item.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    cursor = parent?.parentId ?? null;
  }
  await prisma.item.update({ where: { id: itemId }, data: { parentId: destinationId } });
}

export async function setStarred(userId: string, itemId: string, starred: boolean) {
  const inspected = await inspectItem(userId, itemId);
  if (!inspected || inspected.trashed || !canEdit(inspected.access)) {
    throw new UserError("You can't star that file.");
  }
  await prisma.item.update({ where: { id: itemId }, data: { starred } });
}

export async function trashOwned(userId: string, itemId: string) {
  const inspected = await inspectItem(userId, itemId);
  if (!inspected || !inspected.access.isOwner || !inspected.item.parentId) {
    throw new UserError("Only the owner can move that to the trash.");
  }
  if (inspected.item.trashedAt) return;
  await prisma.item.update({ where: { id: itemId }, data: { trashedAt: new Date() } });
}

export async function restoreOwned(userId: string, itemId: string) {
  const inspected = await inspectItem(userId, itemId);
  if (!inspected || !inspected.access.isOwner || !inspected.item.trashedAt) {
    throw new UserError("That file isn't in your trash.");
  }
  const parent = inspected.item.parentId
    ? await prisma.item.findUnique({ where: { id: inspected.item.parentId }, select: { trashedAt: true } })
    : null;
  const root = await ensureRoot(userId);
  await prisma.item.update({
    where: { id: itemId },
    data: {
      trashedAt: null,
      parentId: parent?.trashedAt ? root.id : inspected.item.parentId,
    },
  });
}

async function descendantStorageKeys(itemId: string) {
  const keys: string[] = [];
  const stack = [itemId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const item = await prisma.item.findUnique({
      where: { id },
      select: { storageKey: true, children: { select: { id: true } } },
    });
    if (!item) continue;
    if (item.storageKey) keys.push(item.storageKey);
    for (const child of item.children) stack.push(child.id);
  }
  return keys;
}

export async function deleteOwned(userId: string, itemId: string) {
  const inspected = await inspectItem(userId, itemId);
  if (!inspected || !inspected.access.isOwner || !inspected.item.parentId || !inspected.item.trashedAt) {
    throw new UserError("Delete files from the trash.");
  }
  const settings = await getSettings();
  const keys = await descendantStorageKeys(itemId);
  await prisma.item.delete({ where: { id: itemId } });
  await Promise.all(keys.map((key) => removeStoredFile(settings.uploadPath, key)));
}

export async function shareWithEmail(userId: string, itemId: string, email: string, permission: Permission) {
  const inspected = await inspectItem(userId, itemId);
  if (!inspected || !inspected.access.isOwner || inspected.trashed) {
    throw new UserError("Only the owner can share that.");
  }
  const recipient = await prisma.user.findUnique({ where: { email } });
  if (!recipient || recipient.disabled) throw new UserError("No active account uses that email.");
  if (recipient.id === inspected.item.ownerId) throw new UserError("That person already owns this file.");
  await prisma.share.upsert({
    where: { itemId_userId: { itemId, userId: recipient.id } },
    create: { itemId, userId: recipient.id, permission },
    update: { permission },
  });
}

export async function changeShare(userId: string, shareId: string, permission: Permission) {
  const share = await prisma.share.findUnique({ where: { id: shareId }, include: { item: true } });
  if (!share || share.item.ownerId !== userId) throw new UserError("Only the owner can change sharing.");
  await prisma.share.update({ where: { id: shareId }, data: { permission } });
}

export async function removeShare(userId: string, shareId: string) {
  const share = await prisma.share.findUnique({ where: { id: shareId }, include: { item: true } });
  if (!share || share.item.ownerId !== userId) throw new UserError("Only the owner can change sharing.");
  await prisma.share.delete({ where: { id: shareId } });
}

export async function updateShareLink(userId: string, itemId: string, enabled: boolean, permission: Permission) {
  const inspected = await inspectItem(userId, itemId);
  if (!inspected || !inspected.access.isOwner || inspected.trashed) {
    throw new UserError("Only the owner can change the link.");
  }
  const existing = await prisma.shareLink.findUnique({ where: { itemId } });
  if (!existing) {
    await prisma.shareLink.create({
      data: { itemId, token: randomBytes(24).toString("base64url"), permission, enabled },
    });
    return;
  }
  await prisma.shareLink.update({ where: { itemId }, data: { enabled, permission } });
}

export async function saveItemContent(input: {
  userId: string | null;
  linkToken?: string | null;
  itemId: string;
  kind: ItemKind;
  title: string;
  content: unknown;
  version: number;
}) {
  const name = cleanItemName(input.title);
  if (!name) throw new UserError("Give this file a name.");
  const access = await combinedAccess({
    userId: input.userId,
    linkToken: input.linkToken,
    itemId: input.itemId,
  });
  if (!access || access.kind !== input.kind) throw new UserError("That file isn't available.");
  if (access.trashed) throw new UserError("Restore this file before editing it.");
  if (!canEdit(access.access)) throw new UserError("You can only view this file.");
  const payload = jsonPayload(input.content);
  await assertStorage(access.ownerId, payload.size - access.sizeBytes);

  await prisma.$transaction(async (tx) => {
    const current = await tx.item.findUnique({ where: { id: input.itemId }, select: { version: true } });
    if (!current || current.version !== input.version) {
      throw new UserError("Someone else saved this file. Reload to see their changes.");
    }
    await tx.item.update({
      where: { id: input.itemId },
      data: { name, sizeBytes: payload.size, version: { increment: 1 } },
    });
    if (input.kind === "DOCUMENT") {
      await tx.document.update({ where: { itemId: input.itemId }, data: { content: payload.content } });
    } else if (input.kind === "SPREADSHEET") {
      await tx.spreadsheet.update({ where: { itemId: input.itemId }, data: { content: payload.content } });
    } else if (input.kind === "PRESENTATION") {
      await tx.presentation.update({ where: { itemId: input.itemId }, data: { content: payload.content } });
    }
  });

  return input.version + 1;
}

export async function readableFile(input: { userId: string | null; linkToken?: string | null; itemId: string }) {
  const access = await combinedAccess(input);
  if (!access || access.kind !== "FILE" || access.trashed || !canView(access.access)) return null;
  const item = await prisma.item.findUnique({ where: { id: input.itemId } });
  if (!item?.storageKey) return null;
  return item;
}
