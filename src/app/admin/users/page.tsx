import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PeopleManager } from "@/components/admin/people";
import { prisma } from "@/lib/db";
import { boot } from "@/lib/guards";
import { GB } from "@/lib/constants";

export default function UsersPage() {
  return (
    <Suspense fallback={<p className="font-display text-3xl italic">Loading people…</p>}>
      <UsersScreen />
    </Suspense>
  );
}

async function UsersScreen() {
  const gate = await boot();
  if (gate.state !== "ready" || gate.user?.role !== "ADMIN") redirect("/login");
  const [users, usage] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.item.groupBy({ by: ["ownerId"], _sum: { sizeBytes: true } }),
  ]);
  const used = new Map(usage.map((row) => [row.ownerId, Number(row._sum.sizeBytes ?? BigInt(0))]));
  return (
    <PeopleManager
      people={users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        disabled: user.disabled,
        quotaGb: user.quotaBytes === null ? "" : String(Number(user.quotaBytes) / GB),
        usedBytes: used.get(user.id) ?? 0,
      }))}
    />
  );
}
