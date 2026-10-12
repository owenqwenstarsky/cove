import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppLoading, DatabaseUnavailable } from "@/components/status";
import { boot } from "@/lib/guards";

export default function Home() {
  return (
    <Suspense fallback={<AppLoading />}>
      <HomeRedirect />
    </Suspense>
  );
}

async function HomeRedirect() {
  const gate = await boot();
  if (gate.state === "db") return <DatabaseUnavailable />;
  if (gate.state === "setup") redirect("/setup");
  if (!gate.user) redirect("/login");
  redirect("/drive");
}
