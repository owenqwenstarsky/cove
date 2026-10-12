import { describe, expect, it } from "vitest";
import {
  maxAccess,
  resolveAccess,
  resolveLinkAccess,
} from "@/lib/permissions";

describe("resolveAccess", () => {
  it("gives the owner edit access", () => {
    expect(
      resolveAccess({ userId: "owner", ownerId: "owner", chainShares: [[]] }),
    ).toEqual({ level: "edit", isOwner: true });
  });

  it("returns none when nothing is shared", () => {
    expect(
      resolveAccess({
        userId: "guest",
        ownerId: "owner",
        chainShares: [[{ userId: "someone", permission: "EDIT" }]],
      }),
    ).toEqual({ level: "none", isOwner: false });
  });

  it("uses a direct view share", () => {
    expect(
      resolveAccess({
        userId: "guest",
        ownerId: "owner",
        chainShares: [[{ userId: "guest", permission: "VIEW" }]],
      }).level,
    ).toBe("view");
  });

  it("inherits edit from a parent folder", () => {
    expect(
      resolveAccess({
        userId: "guest",
        ownerId: "owner",
        chainShares: [[], [{ userId: "guest", permission: "EDIT" }]],
      }).level,
    ).toBe("edit");
  });

  it("keeps the strongest permission on the chain", () => {
    expect(
      resolveAccess({
        userId: "guest",
        ownerId: "owner",
        chainShares: [
          [{ userId: "guest", permission: "VIEW" }],
          [{ userId: "guest", permission: "EDIT" }],
        ],
      }).level,
    ).toBe("edit");
  });
});

describe("link access", () => {
  it("maps link permissions and prefers the stronger grant", () => {
    const link = resolveLinkAccess("VIEW");
    const person = resolveAccess({
      userId: "guest",
      ownerId: "owner",
      chainShares: [[{ userId: "guest", permission: "EDIT" }]],
    });
    expect(maxAccess(link, person)).toEqual({ level: "edit", isOwner: false });
    expect(resolveLinkAccess(null).level).toBe("none");
  });
});
