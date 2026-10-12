import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { AppLoading, DatabaseUnavailable } from "@/components/status";
import { boot } from "@/lib/guards";
import { quotaFor } from "@/lib/users";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppLoading />}>
      <WorkspaceFrame>{children}</WorkspaceFrame>
    </Suspense>
  );
}

async function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const gate = await boot();
  if (gate.state === "db") return <DatabaseUnavailable />;
  if (gate.state === "setup") redirect("/setup");
  if (!gate.user) redirect("/login");
  const quota = await quotaFor(gate.user.id);
  return (
    <AppShell
      siteName={gate.settings.siteName}
      user={gate.user}
      usedBytes={Number(quota.used)}
      quotaBytes={Number(quota.quota)}
    >
      {children}
    </AppShell>
  );
}
