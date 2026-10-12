import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { AppLoading, AuthCard, DatabaseUnavailable } from "@/components/status";
import { boot } from "@/lib/guards";
import { findOpenInvite } from "@/lib/invites";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<AppLoading />}>
      <InviteGate params={params} />
    </Suspense>
  );
}

async function InviteGate({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gate = await boot();
  if (gate.state === "db") return <DatabaseUnavailable />;
  if (gate.state === "setup") redirect("/setup");
  if (gate.user) redirect("/drive");
  if (gate.settings.registrationMode === "closed") {
    return (
      <AuthCard eyebrow="Invites" title="Invites are turned off.">
        <p className="text-sm text-muted">Ask an admin to create an account directly.</p>
      </AuthCard>
    );
  }
  const invite = await findOpenInvite(token);
  if (!invite) {
    return (
      <AuthCard eyebrow="Invites" title="This invite is no longer valid.">
        <p className="text-sm text-muted">Ask for a new link.</p>
      </AuthCard>
    );
  }
  return <SignupForm title="Accept your invite." inviteToken={token} email={invite.email ?? undefined} />;
}
