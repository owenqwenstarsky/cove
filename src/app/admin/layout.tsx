import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { AppLoading, DatabaseUnavailable } from "@/components/status";
import { boot } from "@/lib/guards";
import { quotaFor } from "@/lib/users";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppLoading />}>
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}

async function AdminFrame({ children }: { children: React.ReactNode }) {
  const gate = await boot();
  if (gate.state === "db") return <DatabaseUnavailable />;
  if (gate.state === "setup") redirect("/setup");
  if (!gate.user) redirect("/login");
  if (gate.user.role !== "ADMIN") redirect("/drive");
  const quota = await quotaFor(gate.user.id);
  return (
    <AppShell
      siteName={gate.settings.siteName}
      user={gate.user}
      usedBytes={Number(quota.used)}
      quotaBytes={Number(quota.quota)}
    >
      <div className="border-b border-line px-4 py-3 sm:px-8">
        <nav className="flex gap-4 text-sm">
          <Link href="/admin" className="hover:text-copper">Overview</Link>
          <Link href="/admin/users" className="hover:text-copper">People</Link>
          <Link href="/admin/settings" className="hover:text-copper">Settings</Link>
        </nav>
      </div>
      <div className="px-4 py-8 sm:px-8">{children}</div>
    </AppShell>
  );
}
