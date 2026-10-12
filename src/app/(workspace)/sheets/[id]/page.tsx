import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { SheetEditor } from "@/components/editors/sheet-editor";
import { asSheet } from "@/lib/content";
import { boot } from "@/lib/guards";
import { inspectItem } from "@/lib/access";
import { canEdit, canView } from "@/lib/permissions";

export default function SheetRoute({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-8 py-10 font-display text-3xl italic">Opening spreadsheet…</p>}>
      <SheetScreen params={params} />
    </Suspense>
  );
}

async function SheetScreen({ params }: { params: Promise<{ id: string }> }) {
  const gate = await boot();
  if (gate.state !== "ready" || !gate.user) redirect("/login");
  const { id } = await params;
  const inspected = await inspectItem(gate.user.id, id);
  if (!inspected || inspected.item.kind !== "SPREADSHEET" || !canView(inspected.access) || inspected.trashed) notFound();
  return (
    <SheetEditor
      id={inspected.item.id}
      initialTitle={inspected.item.name}
      initialContent={asSheet(inspected.item.spreadsheet?.content)}
      version={inspected.item.version}
      canEdit={canEdit(inspected.access)}
    />
  );
}
