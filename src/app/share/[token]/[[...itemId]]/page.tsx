import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { DocEditor } from "@/components/editors/doc-editor";
import { SheetEditor } from "@/components/editors/sheet-editor";
import { SlideEditor } from "@/components/editors/slide-editor";
import { AppLoading, DatabaseUnavailable } from "@/components/status";
import { inspectItem, inspectLink } from "@/lib/access";
import { asDoc, asSheet, asSlides } from "@/lib/content";
import { prisma } from "@/lib/db";
import { formatBytes, formatDate } from "@/lib/format";
import { boot } from "@/lib/guards";
import { canEdit, maxAccess } from "@/lib/permissions";

export default function ShareRoute({
  params,
}: {
  params: Promise<{ token: string; itemId?: string[] }>;
}) {
  return (
    <Suspense fallback={<AppLoading />}>
      <ShareScreen params={params} />
    </Suspense>
  );
}

async function ShareScreen({ params }: { params: Promise<{ token: string; itemId?: string[] }> }) {
  const { token, itemId } = await params;
  if (itemId && itemId.length > 1) notFound();
  const gate = await boot();
  if (gate.state === "db") return <DatabaseUnavailable />;
  if (gate.state === "setup") redirect("/setup");
  const linked = await inspectLink(token, itemId?.[0]);
  if (!linked) notFound();

  let access = linked.access;
  if (gate.state === "ready" && gate.user) {
    const mine = await inspectItem(gate.user.id, linked.item.id);
    if (mine) access = maxAccess(access, mine.access);
  }
  const editable = canEdit(access) && !linked.trashed;

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-8">
        <p className="font-display text-2xl italic">{gate.state === "ready" ? gate.settings.siteName : "Cove"}</p>
        {gate.state === "ready" && gate.user ? (
          <Link href="/drive" className="text-sm text-tide underline">
            My Drive
          </Link>
        ) : (
          <Link href="/login" className="text-sm text-tide underline">
            Sign in
          </Link>
        )}
      </header>
      {linked.trashed ? (
        <p className="px-8 py-16 text-muted">This file is in the trash.</p>
      ) : linked.item.kind === "FOLDER" ? (
        <SharedFolder token={token} folderId={linked.item.id} name={linked.item.name} />
      ) : linked.item.kind === "FILE" ? (
        <div className="px-8 py-16">
          <h1 className="font-display text-4xl italic">{linked.item.name}</h1>
          <a className="mt-6 inline-block rounded-full bg-copper px-4 py-2 text-sm text-white" href={`/api/files/${linked.item.id}?link=${token}`}>
            Download
          </a>
        </div>
      ) : linked.item.kind === "DOCUMENT" ? (
        <DocEditor
          id={linked.item.id}
          initialTitle={linked.item.name}
          initialContent={asDoc(linked.item.document?.content)}
          version={linked.item.version}
          canEdit={editable}
          linkToken={token}
        />
      ) : linked.item.kind === "SPREADSHEET" ? (
        <SheetEditor
          id={linked.item.id}
          initialTitle={linked.item.name}
          initialContent={asSheet(linked.item.spreadsheet?.content)}
          version={linked.item.version}
          canEdit={editable}
          linkToken={token}
        />
      ) : (
        <SlideEditor
          id={linked.item.id}
          initialTitle={linked.item.name}
          initialContent={asSlides(linked.item.presentation?.content)}
          version={linked.item.version}
          canEdit={editable}
          linkToken={token}
        />
      )}
    </main>
  );
}

async function SharedFolder({ token, folderId, name }: { token: string; folderId: string; name: string }) {
  const children = await prisma.item.findMany({
    where: { parentId: folderId, trashedAt: null },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  return (
    <div className="px-4 py-8 sm:px-8">
      <h1 className="font-display text-4xl italic">{name}</h1>
      {children.length === 0 ? (
        <p className="mt-8 text-muted">This folder is empty.</p>
      ) : (
        <ul className="mt-8 overflow-hidden rounded-3xl border border-line bg-card">
          {children.map((child) => {
            const href = child.kind === "FILE" ? `/api/files/${child.id}?link=${token}` : `/share/${token}/${child.id}`;
            return (
              <li key={child.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <a href={href} className="truncate">
                  {child.name}
                </a>
                <span className="text-sm text-muted">
                  {formatBytes(Number(child.sizeBytes))} · {formatDate(child.updatedAt.toISOString())}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
