import { Suspense } from "react";
import { DriveBrowser } from "@/components/drive/drive-browser";
import { boot } from "@/lib/guards";
import { loadDrive } from "@/lib/drive";
import { requestOrigin } from "@/lib/http";
import { redirect } from "next/navigation";

export default function DriveRoute({
  params,
  searchParams,
}: {
  params: Promise<{ folderId?: string[] }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<p className="px-8 py-10 font-display text-3xl italic">Loading files…</p>}>
      <DriveScreen params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DriveScreen({
  params,
  searchParams,
}: {
  params: Promise<{ folderId?: string[] }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const gate = await boot();
  if (gate.state !== "ready" || !gate.user) redirect("/login");
  const [{ folderId }, query, origin] = await Promise.all([params, searchParams, requestOrigin()]);
  const q = Array.isArray(query.q) ? query.q[0] : query.q;
  const drive = await loadDrive(gate.user.id, folderId, q ?? "", origin);
  return <DriveBrowser {...drive} />;
}
