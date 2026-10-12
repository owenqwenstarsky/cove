import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/admin/settings-form";
import { GB, MB } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { boot } from "@/lib/guards";
import { requestOrigin } from "@/lib/http";
import { formatDate } from "@/lib/format";

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="font-display text-3xl italic">Loading settings…</p>}>
      <SettingsScreen />
    </Suspense>
  );
}

async function SettingsScreen() {
  const gate = await boot();
  if (gate.state !== "ready" || gate.user?.role !== "ADMIN") redirect("/login");
  const [origin, invites] = await Promise.all([
    requestOrigin(),
    prisma.invite.findMany({ where: { usedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <SettingsForm
      siteName={gate.settings.siteName}
      registrationMode={gate.settings.registrationMode}
      quotaGb={gate.settings.defaultQuotaBytes / GB}
      uploadMb={gate.settings.maxUploadBytes / MB}
      invites={invites.map((invite) => ({
        id: invite.id,
        url: `${origin}/invite/${invite.token}`,
        email: invite.email,
        expiresAt: invite.expiresAt ? formatDate(invite.expiresAt.toISOString()) : "no expiry",
      }))}
    />
  );
}
