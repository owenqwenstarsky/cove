import "server-only";
import { notFound } from "next/navigation";
import type { Permission } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loadGraph, type GraphNode } from "@/lib/access";
import { canEdit, canView } from "@/lib/permissions";
import { ensureRoot } from "@/lib/users";
import { formatBytes } from "@/lib/format";

export type DriveView = "browse" | "shared" | "starred" | "trash" | "search";

export type BrowserItem = {
  id: string;
  name: string;
  kind: GraphNode["kind"];
  starred: boolean;
  updatedAt: string;
  sizeLabel: string;
  ownerName: string;
  access: "view" | "edit" | "owner";
  shares: { id: string; email: string; name: string; permission: Permission }[];
  link: { url: string; permission: Permission; enabled: boolean } | null;
};

export type FolderChoice = { id: string; name: string; depth: number };
export type Crumb = { href: string; label: string };

const EMPTY: Record<DriveView, string> = {
  browse: "This folder is empty.",
  shared: "Nothing has been shared with you yet.",
  starred: "No starred files yet.",
  trash: "Trash is empty.",
  search: "No files match that search.",
};

function nestFolders(folders: { id: string; name: string; parentId: string | null }[]): FolderChoice[] {
  const ids = new Set(folders.map((folder) => folder.id));
  const byParent = new Map<string | null, typeof folders>();
  for (const folder of folders) {
    const key = folder.parentId && ids.has(folder.parentId) ? folder.parentId : null;
    const list = byParent.get(key) ?? [];
    list.push(folder);
    byParent.set(key, list);
  }
  const out: FolderChoice[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    const kids = (byParent.get(parentId) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    for (const kid of kids) {
      if (seen.has(kid.id)) continue;
      seen.add(kid.id);
      out.push({ id: kid.id, name: kid.name, depth });
      walk(kid.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function sortItems(items: GraphNode[]) {
  return items.sort((a, b) => {
    const folderDelta = Number(a.kind !== "FOLDER") - Number(b.kind !== "FOLDER");
    if (folderDelta !== 0) return folderDelta;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export async function loadDrive(userId: string, segments: string[] | undefined, query: string, origin: string) {
  await ensureRoot(userId);
  const graph = await loadGraph(userId);
  const nodes = [...graph.byId.values()];
  const root = nodes.find((node) => node.ownerId === userId && node.parentId === null && node.kind === "FOLDER");
  if (!root) notFound();

  const needle = query.trim();
  let view: DriveView = "browse";
  let parent: GraphNode | null = root;
  let title = "My Drive";

  if (needle) {
    view = "search";
    title = `Results for “${needle}”`;
    parent = null;
  } else if (!segments?.length) {
    view = "browse";
  } else if (segments.length === 1 && (segments[0] === "shared" || segments[0] === "starred" || segments[0] === "trash")) {
    view = segments[0];
    parent = null;
    title = view === "shared" ? "Shared with me" : view === "starred" ? "Starred" : "Trash";
  } else if (segments.length === 1) {
    const folder = graph.inspect(segments[0]);
    if (!folder || folder.chain[0]?.kind !== "FOLDER" || !canView(folder.access) || folder.trashed) notFound();
    parent = folder.chain[0];
    title = parent.id === root.id ? "My Drive" : parent.name;
  } else {
    notFound();
  }

  let visible: GraphNode[] = [];
  if (view === "search") {
    const lowered = needle.toLowerCase();
    visible = nodes.filter((node) => {
      if (!node.parentId && node.kind === "FOLDER") return false;
      if (!node.name.toLowerCase().includes(lowered)) return false;
      const inspected = graph.inspect(node.id);
      return Boolean(inspected && canView(inspected.access) && !inspected.trashed);
    });
  } else if (view === "shared") {
    visible = nodes.filter((node) => {
      if (!graph.hasDirectShare(node.id) || node.ownerId === userId) return false;
      const inspected = graph.inspect(node.id);
      return Boolean(inspected && canView(inspected.access) && !inspected.trashed);
    });
  } else if (view === "starred") {
    visible = nodes.filter((node) => {
      if (!node.starred) return false;
      const inspected = graph.inspect(node.id);
      return Boolean(inspected && canView(inspected.access) && !inspected.trashed);
    });
  } else if (view === "trash") {
    visible = nodes.filter((node) => {
      if (node.ownerId !== userId || !node.trashedAt) return false;
      const parentNode = node.parentId ? graph.byId.get(node.parentId) : null;
      return !parentNode?.trashedAt;
    });
  } else if (parent) {
    visible = nodes.filter((node) => {
      if (node.parentId !== parent?.id || node.trashedAt) return false;
      const inspected = graph.inspect(node.id);
      return Boolean(inspected && canView(inspected.access));
    });
  }

  visible = sortItems(visible);
  const ownedIds = visible.filter((node) => node.ownerId === userId).map((node) => node.id);
  const [shareRows, linkRows] = ownedIds.length
    ? await Promise.all([
        prisma.share.findMany({
          where: { itemId: { in: ownedIds } },
          include: { user: { select: { email: true, name: true } } },
        }),
        prisma.shareLink.findMany({ where: { itemId: { in: ownedIds } } }),
      ])
    : [[], []];

  const sharesByItem = new Map<string, BrowserItem["shares"]>();
  for (const share of shareRows) {
    const list = sharesByItem.get(share.itemId) ?? [];
    list.push({
      id: share.id,
      email: share.user.email,
      name: share.user.name,
      permission: share.permission,
    });
    sharesByItem.set(share.itemId, list);
  }
  const linksByItem = new Map(linkRows.map((link) => [link.itemId, link]));

  const items: BrowserItem[] = visible.map((node) => {
    const inspected = graph.inspect(node.id);
    const access = inspected?.access.isOwner ? "owner" : inspected?.access.level === "edit" ? "edit" : "view";
    const link = linksByItem.get(node.id);
    return {
      id: node.id,
      name: node.name,
      kind: node.kind,
      starred: node.starred,
      updatedAt: node.updatedAt.toISOString(),
      sizeLabel: formatBytes(Number(node.sizeBytes)),
      ownerName: node.ownerName,
      access,
      shares: access === "owner" ? (sharesByItem.get(node.id) ?? []) : [],
      link:
        access === "owner" && link
          ? { url: `${origin}/share/${link.token}`, permission: link.permission, enabled: link.enabled }
          : null,
    };
  });

  const folders = nestFolders(
    nodes
      .filter((node) => {
        if (node.kind !== "FOLDER") return false;
        const inspected = graph.inspect(node.id);
        return Boolean(inspected && !inspected.trashed && canEdit(inspected.access));
      })
      .map((node) => ({ id: node.id, name: node.name, parentId: node.parentId })),
  );

  let crumbs: Crumb[] = [];
  if (view === "browse" && parent) {
    const inspected = graph.inspect(parent.id);
    const rootFirst = [...(inspected?.chain ?? [])].reverse();
    if (inspected?.access.isOwner) {
      crumbs = rootFirst.map((node, index) => ({
        href: index === 0 ? "/drive" : `/drive/${node.id}`,
        label: index === 0 ? "My Drive" : node.name,
      }));
    } else {
      crumbs = [
        { href: "/drive/shared", label: "Shared" },
        ...rootFirst
          .filter((node) => {
            const part = graph.inspect(node.id);
            return Boolean(part && canView(part.access));
          })
          .map((node) => ({ href: `/drive/${node.id}`, label: node.name })),
      ];
    }
  }

  const parentAccess = parent ? graph.inspect(parent.id) : null;
  return {
    view,
    title,
    query: needle,
    crumbs,
    items,
    parentId: parent?.id ?? null,
    canCreate: Boolean(view === "browse" && parentAccess && canEdit(parentAccess.access) && !parentAccess.trashed),
    folders,
    empty: EMPTY[view],
  };
}
