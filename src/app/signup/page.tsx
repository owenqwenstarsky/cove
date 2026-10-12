import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { AppLoading, AuthCard, DatabaseUnavailable } from "@/components/status";
import { boot } from "@/lib/guards";

export default function SignupPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <SignupGate />
    </Suspense>
  );
}

async function SignupGate() {
  const gate = await boot();
  if (gate.state === "db") return <DatabaseUnavailable />;
  if (gate.state === "setup") redirect("/setup");
  if (gate.user) redirect("/drive");
  if (gate.settings.registrationMode !== "open") {
    return (
      <AuthCard eyebrow="Closed" title="An admin has to create your account.">
        <p className="text-sm text-muted">Public signup is off for this Cove.</p>
      </AuthCard>
    );
  }
  return <SignupForm title="Create your account." />;
}
