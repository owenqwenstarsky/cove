import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { AppLoading, DatabaseUnavailable } from "@/components/status";
import { boot } from "@/lib/guards";

export default function LoginPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <LoginGate />
    </Suspense>
  );
}

async function LoginGate() {
  const gate = await boot();
  if (gate.state === "db") return <DatabaseUnavailable />;
  if (gate.state === "setup") redirect("/setup");
  if (gate.user) redirect("/drive");
  return <LoginForm siteName={gate.settings.siteName} registrationMode={gate.settings.registrationMode} />;
}
