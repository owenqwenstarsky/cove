import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { SlideEditor } from "@/components/editors/slide-editor";
import { asSlides } from "@/lib/content";
import { boot } from "@/lib/guards";
import { inspectItem } from "@/lib/access";
import { canEdit, canView } from "@/lib/permissions";

export default function SlideRoute({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-8 py-10 font-display text-3xl italic">Opening presentation…</p>}>
      <SlideScreen params={params} />
    </Suspense>
  );
}

async function SlideScreen({ params }: { params: Promise<{ id: string }> }) {
  const gate = await boot();
  if (gate.state !== "ready" || !gate.user) redirect("/login");
  const { id } = await params;
  const inspected = await inspectItem(gate.user.id, id);
  if (!inspected || inspected.item.kind !== "PRESENTATION" || !canView(inspected.access) || inspected.trashed) notFound();
  return (
    <SlideEditor
      id={inspected.item.id}
      initialTitle={inspected.item.name}
      initialContent={asSlides(inspected.item.presentation?.content)}
      version={inspected.item.version}
      canEdit={canEdit(inspected.access)}
    />
  );
}
