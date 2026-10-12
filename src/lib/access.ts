import "server-only";
import type { ItemKind, Permission } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveAccess, resolveLinkAccess, maxAccess, type Access } from "@/lib/permissions";

export type GraphNode = {
  id: string;
  name: string;
  kind: ItemKind;
  parentId: string | null;
  ownerId: string;
  ownerName: string;
  trashedAt: Date | null;
  starred: boolean;
  updatedAt: Date;
  sizeBytes: bigint;
  mimeType: string | null;
};

export async function loadGraph(userId: string) {
  const [items, shares] = await Promise.all([
    prisma.item.findMany({
      select: {
        id: true,
        name: true,
        kind: true,
        parentId: true,
        ownerId: true,
        trashedAt: true,
        starred: true,
        updatedAt: true,
        sizeBytes: true,
        mimeType: true,
        owner: { select: { name: true } },
      },
    }),
    prisma.share.findMany({
      where: { userId },
      select: { itemId: true, permission: true },
    }),
  ]);

  const byId = new Map<string, GraphNode>();
  for (const item of items) {
    byId.set(item.id, { ...item, ownerName: item.owner.name });
  }

  const sharesByItem = new Map<string, { userId: string; permission: Permission }[]>();
  for (const share of shares) {
    const list = sharesByItem.get(share.itemId) ?? [];
    list.push({ userId, permission: share.permission });
    sharesByItem.set(share.itemId, list);
  }

  function inspect(itemId: string) {
    const chain: GraphNode[] = [];
    const seen = new Set<string>();
    let current: string | null = itemId;
    while (current) {
      if (seen.has(current)) break;
      seen.add(current);
      const node = byId.get(current);
      if (!node) break;
      chain.push(node);
      current = node.parentId;
    }
    if (chain.length === 0) return null;
    const access = resolveAccess({
      userId,
      ownerId: chain[0].ownerId,
      chainShares: chain.map((node) => sharesByItem.get(node.id) ?? []),
    });
    return {
      access,
      trashed: chain.some((node) => node.trashedAt !== null),
      chain,
    };
  }

  return {
    byId,
    inspect,
    hasDirectShare(itemId: string) {
      return sharesByItem.has(itemId);
    },
  };
}

export async function inspectItem(userId: string, itemId: string) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      owner: { select: { name: true, email: true } },
      document: true,
      spreadsheet: true,
      presentation: true,
      shareLink: true,
      shares: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });
  if (!item) return null;

  const chainShares: { userId: string; permission: Permission }[][] = [
    item.shares.map((share) => ({ userId: share.userId, permission: share.permission })),
  ];
  const ancestors: { id: string; name: string; parentId: string | null; trashedAt: Date | null }[] = [];
  let parentId = item.parentId;
  const seen = new Set<string>([item.id]);
  while (parentId) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = await prisma.item.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        name: true,
        parentId: true,
        trashedAt: true,
        shares: { where: { userId }, select: { userId: true, permission: true } },
      },
    });
    if (!parent) break;
    ancestors.push(parent);
    chainShares.push(parent.shares);
    parentId = parent.parentId;
  }

  const access = resolveAccess({
    userId,
    ownerId: item.ownerId,
    chainShares,
  });

  return {
    item,
    access,
    trashed: item.trashedAt !== null || ancestors.some((ancestor) => ancestor.trashedAt !== null),
    ancestors,
  };
}

export async function inspectLink(token: string, itemId?: string) {
  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link?.enabled) return null;
  const targetId = itemId ?? link.itemId;
  const item = await prisma.item.findUnique({
    where: { id: targetId },
    include: {
      owner: { select: { name: true } },
      document: true,
      spreadsheet: true,
      presentation: true,
    },
  });
  if (!item) return null;

  let cursor: { id: string; parentId: string | null; trashedAt: Date | null } | null = item;
  let found = false;
  let trashed = false;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor.id)) break;
    seen.add(cursor.id);
    if (cursor.trashedAt) trashed = true;
    if (cursor.id === link.itemId) found = true;
    if (!cursor.parentId) break;
    cursor = await prisma.item.findUnique({
      where: { id: cursor.parentId },
      select: { id: true, parentId: true, trashedAt: true },
    });
  }
  if (!found) return null;
  return { item, link, trashed, access: resolveLinkAccess(link.permission) };
}

export async function combinedAccess(input: {
  userId: string | null;
  linkToken?: string | null;
  itemId: string;
}): Promise<{ access: Access; trashed: boolean; ownerId: string; kind: ItemKind; version: number; sizeBytes: bigint; name: string } | null> {
  let access: Access = { level: "none", isOwner: false };
  let trashed = false;
  let record: { ownerId: string; kind: ItemKind; version: number; sizeBytes: bigint; name: string } | null = null;

  if (input.userId) {
    const inspected = await inspectItem(input.userId, input.itemId);
    if (inspected) {
      access = inspected.access;
      trashed = inspected.trashed;
      record = inspected.item;
    }
  }

  if (input.linkToken) {
    const linked = await inspectLink(input.linkToken, input.itemId);
    if (linked) {
      access = maxAccess(access, linked.access);
      trashed = trashed || linked.trashed;
      record = linked.item;
    }
  }

  if (!record || access.level === "none") return null;
  return { access, trashed, ...record };
}
