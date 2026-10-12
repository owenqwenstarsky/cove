import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/auth/setup-wizard";
import { AppLoading, DatabaseUnavailable } from "@/components/status";
import { boot } from "@/lib/guards";

export default function SetupPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <SetupGate />
    </Suspense>
  );
}

async function SetupGate() {
  const gate = await boot();
  if (gate.state === "db") return <DatabaseUnavailable />;
  if (gate.state === "ready") redirect("/drive");
  return <SetupWizard />;
}
