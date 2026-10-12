import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { DocEditor } from "@/components/editors/doc-editor";
import { asDoc } from "@/lib/content";
import { boot } from "@/lib/guards";
import { inspectItem } from "@/lib/access";
import { canEdit, canView } from "@/lib/permissions";

export default function DocRoute({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-8 py-10 font-display text-3xl italic">Opening document…</p>}>
      <DocScreen params={params} />
    </Suspense>
  );
}

async function DocScreen({ params }: { params: Promise<{ id: string }> }) {
  const gate = await boot();
  if (gate.state !== "ready" || !gate.user) redirect("/login");
  const { id } = await params;
  const inspected = await inspectItem(gate.user.id, id);
  if (!inspected || inspected.item.kind !== "DOCUMENT" || !canView(inspected.access) || inspected.trashed) notFound();
  return (
    <DocEditor
      id={inspected.item.id}
      initialTitle={inspected.item.name}
      initialContent={asDoc(inspected.item.document?.content)}
      version={inspected.item.version}
      canEdit={canEdit(inspected.access)}
    />
  );
}
