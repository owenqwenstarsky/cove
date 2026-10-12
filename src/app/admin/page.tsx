import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { formatBytes } from "@/lib/format";
import { boot } from "@/lib/guards";
import { redirect } from "next/navigation";

export default function AdminHome() {
  return (
    <Suspense fallback={<p className="font-display text-3xl italic">Loading overview…</p>}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const gate = await boot();
  if (gate.state !== "ready" || gate.user?.role !== "ADMIN") redirect("/login");
  const [people, files, storage] = await Promise.all([
    prisma.user.count(),
    prisma.item.count({ where: { kind: { not: "FOLDER" } } }),
    prisma.item.aggregate({ _sum: { sizeBytes: true } }),
  ]);
  const cards = [
    ["People", String(people)],
    ["Files", String(files)],
    ["Stored", formatBytes(Number(storage._sum.sizeBytes ?? BigInt(0)))],
    ["Signup", gate.settings.registrationMode],
  ];
  return (
    <div>
      <h1 className="font-display text-4xl italic">{gate.settings.siteName}</h1>
      <p className="mt-2 text-muted">Site management stays here. Files that belong to other people stay in their drives.</p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-line bg-card px-5 py-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-2 font-display text-3xl italic capitalize">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
