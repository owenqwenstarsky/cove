"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HardDrive, LogOut, Menu, Settings, Star, Trash2, Users, X } from "lucide-react";
import { logout } from "@/app/auth-actions";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/cn";

const links = [
  { href: "/drive", label: "My Drive", icon: HardDrive, match: "drive" },
  { href: "/drive/shared", label: "Shared", icon: Users, match: "shared" },
  { href: "/drive/starred", label: "Starred", icon: Star, match: "starred" },
  { href: "/drive/trash", label: "Trash", icon: Trash2, match: "trash" },
] as const;

function activeMatch(pathname: string, match: (typeof links)[number]["match"]) {
  if (match === "shared") return pathname.startsWith("/drive/shared");
  if (match === "starred") return pathname.startsWith("/drive/starred");
  if (match === "trash") return pathname.startsWith("/drive/trash");
  return (
    pathname === "/drive" ||
    /^\/drive\/(?!shared|starred|trash).+/.test(pathname) ||
    pathname.startsWith("/docs") ||
    pathname.startsWith("/sheets") ||
    pathname.startsWith("/slides")
  );
}

export function AppShell({
  siteName,
  user,
  usedBytes,
  quotaBytes,
  children,
}: {
  siteName: string;
  user: { name: string; email: string; role: "ADMIN" | "USER" };
  usedBytes: number;
  quotaBytes: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const ratio = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[15.5rem_1fr]">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur md:hidden">
        <button type="button" className="rounded-full p-2 hover:bg-black/5" aria-label="Open menu" onClick={() => setOpenPath(pathname)}>
          <Menu className="size-5" />
        </button>
        <span className="font-display text-2xl italic">{siteName}</span>
      </header>
      {open ? (
        <button type="button" className="fixed inset-0 z-40 bg-black/40 md:hidden" aria-label="Close menu" onClick={() => setOpenPath(null)} />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar px-3 py-4 text-sidebar-foreground md:static md:z-auto md:w-auto",
          open ? "flex" : "hidden md:flex",
        )}
      >
        <div className="flex items-center justify-between px-2">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-copper">Cove</p>
            <p className="font-display text-3xl italic leading-none">{siteName}</p>
          </div>
          <button type="button" className="rounded-full p-2 md:hidden" aria-label="Close menu" onClick={() => setOpenPath(null)}>
            <X className="size-4" />
          </button>
        </div>
        <nav className="mt-8 grid gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = activeMatch(pathname, link.match);
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                  active ? "bg-white/10 text-white" : "text-sidebar-foreground/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-4" />
                {link.label}
              </Link>
            );
          })}
          {user.role === "ADMIN" ? (
            <Link
              href="/admin"
              className={cn(
                "mt-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                pathname.startsWith("/admin") ? "bg-white/10 text-white" : "text-sidebar-foreground/75 hover:bg-white/10",
              )}
            >
              <Settings className="size-4" />
              Admin
            </Link>
          ) : null}
        </nav>
        <div className="mt-auto px-2 pt-6">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className={cn("h-full rounded-full", ratio > 90 ? "bg-copper" : "bg-tide")} style={{ width: `${ratio}%` }} />
          </div>
          <p className="mt-2 text-xs text-sidebar-foreground/70">
            {formatBytes(usedBytes)} of {formatBytes(quotaBytes)}
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm">{user.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{user.email}</p>
            </div>
            <form action={logout}>
              <button type="submit" className="rounded-full p-2 text-sidebar-foreground/70 hover:bg-white/10" aria-label="Log out">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
