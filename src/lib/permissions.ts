export type PermissionLevel = "VIEW" | "EDIT";
export type AccessLevel = "none" | "view" | "edit";

export type ShareGrant = {
  userId: string;
  permission: PermissionLevel;
};

export type Access = {
  level: AccessLevel;
  isOwner: boolean;
};

const rank: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 };

export function resolveAccess(input: {
  userId: string;
  ownerId: string;
  chainShares: ShareGrant[][];
}): Access {
  if (input.userId === input.ownerId) {
    return { level: "edit", isOwner: true };
  }

  let best: AccessLevel = "none";
  for (const shares of input.chainShares) {
    for (const share of shares) {
      if (share.userId !== input.userId) continue;
      const level: AccessLevel = share.permission === "EDIT" ? "edit" : "view";
      if (rank[level] > rank[best]) best = level;
    }
  }

  return { level: best, isOwner: false };
}

export function resolveLinkAccess(permission: PermissionLevel | null): Access {
  if (permission === "EDIT") return { level: "edit", isOwner: false };
  if (permission === "VIEW") return { level: "view", isOwner: false };
  return { level: "none", isOwner: false };
}

export function maxAccess(a: Access, b: Access): Access {
  const level = rank[a.level] >= rank[b.level] ? a.level : b.level;
  return { level, isOwner: a.isOwner || b.isOwner };
}

export function canView(access: Access): boolean {
  return access.level === "view" || access.level === "edit";
}

export function canEdit(access: Access): boolean {
  return access.level === "edit";
}
