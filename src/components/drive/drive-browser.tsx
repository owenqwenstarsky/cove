"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderInput,
  MoreHorizontal,
  Plus,
  Presentation,
  RotateCcw,
  Search,
  Share2,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import {
  addShare,
  createDocument,
  createFolder,
  createPresentation,
  createSpreadsheet,
  deleteItem,
  deleteShare,
  moveItem,
  renameItem,
  restoreItem,
  saveLink,
  setSharePermission,
  starItem,
  trashItem,
} from "@/app/(workspace)/actions";
import type { BrowserItem, Crumb, DriveView, FolderChoice } from "@/lib/drive";
import type { ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SelectField, TextField } from "@/components/ui/field";

function KindIcon({ kind }: { kind: BrowserItem["kind"] }) {
  const className = "size-5 shrink-0";
  if (kind === "FOLDER") return <Folder className={`${className} text-copper`} />;
  if (kind === "DOCUMENT") return <FileText className={`${className} text-tide`} />;
  if (kind === "SPREADSHEET") return <FileSpreadsheet className={`${className} text-[#3d6b4f]`} />;
  if (kind === "PRESENTATION") return <Presentation className={`${className} text-[#8a4b2f]`} />;
  return <File className={`${className} text-muted`} />;
}

function hrefFor(item: BrowserItem, view: DriveView) {
  if (view === "trash") return null;
  if (item.kind === "FOLDER") return `/drive/${item.id}`;
  if (item.kind === "DOCUMENT") return `/docs/${item.id}`;
  if (item.kind === "SPREADSHEET") return `/sheets/${item.id}`;
  if (item.kind === "PRESENTATION") return `/slides/${item.id}`;
  return `/api/files/${item.id}`;
}

export function DriveBrowser({
  view,
  title,
  query,
  crumbs,
  items,
  parentId,
  canCreate,
  folders,
  empty,
}: {
  view: DriveView;
  title: string;
  query: string;
  crumbs: Crumb[];
  items: BrowserItem[];
  parentId: string | null;
  canCreate: boolean;
  folders: FolderChoice[];
  empty: string;
}) {
  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          {crumbs.length > 1 ? (
            <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm text-muted">
              {crumbs.map((crumb, index) => (
                <span key={crumb.href} className="flex items-center gap-1">
                  {index > 0 ? <ChevronRight className="size-3.5" /> : null}
                  {index === crumbs.length - 1 ? (
                    <span className="text-foreground">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} prefetch={true} className="hover:text-foreground">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          ) : null}
          <h1 className="font-display text-4xl italic leading-none">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/drive" className="flex items-center gap-2 rounded-full bg-paper px-3 py-2 ring-1 ring-line">
            <Search className="size-4 text-muted" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search files"
              aria-label="Search files"
              className="w-40 bg-transparent text-sm outline-none placeholder:text-muted sm:w-56"
            />
          </form>
          {canCreate && parentId ? <NewMenu parentId={parentId} /> : null}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-16 rounded-3xl border border-dashed border-line bg-paper/60 px-6 py-16 text-center">
          <p className="font-display text-3xl italic">{empty}</p>
          {canCreate ? <p className="mt-2 text-sm text-muted">Use New to add a folder, file, or document.</p> : null}
        </div>
      ) : (
        <ul className="mt-8 overflow-hidden rounded-3xl border border-line bg-card">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} view={view} folders={folders} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NewMenu({ parentId }: { parentId: string }) {
  const [open, setOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadError("");
    for (const file of files) {
      const body = new FormData();
      body.set("file", file);
      body.set("parentId", parentId);
      const response = await fetch("/api/upload", { method: "POST", body });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setUploadError(data?.error ?? `${file.name} couldn't be uploaded.`);
        setUploading(false);
        return;
      }
    }
    setUploading(false);
    router.refresh();
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button type="button" onClick={() => setOpen((value) => !value)}>
        <Plus className="size-4" />
        New
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-line bg-card p-1 shadow-xl">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-background"
            onClick={() => {
              setOpen(false);
              setFolderOpen(true);
            }}
          >
            <Folder className="size-4 text-copper" />
            Folder
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-background"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" />
            {uploading ? "Uploading…" : "File upload"}
          </button>
          <CreateButton action={createDocument} parentId={parentId} icon={<FileText className="size-4 text-tide" />} label="Document" />
          <CreateButton action={createSpreadsheet} parentId={parentId} icon={<FileSpreadsheet className="size-4 text-[#3d6b4f]" />} label="Spreadsheet" />
          <CreateButton action={createPresentation} parentId={parentId} icon={<Presentation className="size-4 text-[#8a4b2f]" />} label="Presentation" />
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          void upload(event.target.files);
          event.target.value = "";
          setOpen(false);
        }}
      />
      {uploadError ? <p className="absolute right-0 mt-2 w-56 text-xs text-danger">{uploadError}</p> : null}
      <FolderDialog open={folderOpen} parentId={parentId} onClose={() => setFolderOpen(false)} />
    </div>
  );
}

function CreateButton({
  action,
  parentId,
  icon,
  label,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  parentId: string;
  icon: React.ReactNode;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction}>
      <input type="hidden" name="parentId" value={parentId} />
      <button type="submit" disabled={pending} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-background">
        {icon}
        {label}
      </button>
      {state.error ? <p className="px-3 pb-2 text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

function FolderDialog({ open, parentId, onClose }: { open: boolean; parentId: string; onClose: () => void }) {
  const [state, action, pending] = useActionState(createFolder, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);
  return (
    <Modal open={open} title="New folder" onClose={onClose}>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="parentId" value={parentId} />
        <TextField label="Name" name="name" required autoFocus placeholder="New folder" />
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create folder"}
        </Button>
      </form>
    </Modal>
  );
}

function ItemRow({ item, view, folders }: { item: BrowserItem; view: DriveView; folders: FolderChoice[] }) {
  const href = hrefFor(item, view);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<"rename" | "move" | "share" | "delete" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);

  const name = href ? (
    item.kind === "FILE" ? (
      <a href={href} className="flex min-w-0 items-center gap-3">
        <KindIcon kind={item.kind} />
        <span className="truncate">{item.name}</span>
      </a>
    ) : (
      <Link href={href} prefetch={true} className="flex min-w-0 items-center gap-3">
        <KindIcon kind={item.kind} />
        <span className="truncate">{item.name}</span>
      </Link>
    )
  ) : (
    <span className="flex min-w-0 items-center gap-3">
      <KindIcon kind={item.kind} />
      <span className="truncate">{item.name}</span>
    </span>
  );

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-paper/80 sm:grid-cols-[minmax(0,1fr)_9rem_8rem_auto]">
      {name}
      <span className="hidden truncate text-sm text-muted sm:block">{item.ownerName}</span>
      <span className="hidden text-sm text-muted sm:block">{formatDate(item.updatedAt)}</span>
      <div className="relative" ref={menuRef}>
        <button type="button" className="rounded-full p-2 hover:bg-black/5" aria-label={`Actions for ${item.name}`} onClick={() => setMenu((value) => !value)}>
          <MoreHorizontal className="size-4" />
        </button>
        {menu ? (
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-2xl border border-line bg-card p-1 shadow-xl">
            {view !== "trash" && item.access !== "view" ? (
              <button type="button" className="menu-item" onClick={() => { setMenu(false); setDialog("rename"); }}>
                Rename
              </button>
            ) : null}
            {view !== "trash" && item.access === "owner" ? (
              <button type="button" className="menu-item" onClick={() => { setMenu(false); setDialog("move"); }}>
                <FolderInput className="size-4" /> Move
              </button>
            ) : null}
            {view !== "trash" && item.access !== "view" ? (
              <form action={starItem}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="starred" value={item.starred ? "false" : "true"} />
                <button type="submit" className="menu-item">
                  <Star className="size-4" /> {item.starred ? "Unstar" : "Star"}
                </button>
              </form>
            ) : null}
            {view !== "trash" && item.access === "owner" ? (
              <>
                <button type="button" className="menu-item" onClick={() => { setMenu(false); setDialog("share"); }}>
                  <Share2 className="size-4" /> Share
                </button>
                <form action={trashItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="menu-item text-danger">
                    <Trash2 className="size-4" /> Move to trash
                  </button>
                </form>
              </>
            ) : null}
            {view === "trash" ? (
              <>
                <form action={restoreItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="menu-item">
                    <RotateCcw className="size-4" /> Restore
                  </button>
                </form>
                <button type="button" className="menu-item text-danger" onClick={() => { setMenu(false); setDialog("delete"); }}>
                  Delete forever
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {dialog === "rename" ? <RenameDialog item={item} open onClose={() => setDialog(null)} /> : null}
      {dialog === "move" ? <MoveDialog item={item} folders={folders} open onClose={() => setDialog(null)} /> : null}
      {dialog === "share" ? <ShareDialog item={item} open onClose={() => setDialog(null)} /> : null}
      {dialog === "delete" ? <DeleteDialog item={item} open onClose={() => setDialog(null)} /> : null}
    </li>
  );
}

function RenameDialog({ item, open, onClose }: { item: BrowserItem; open: boolean; onClose: () => void }) {
  const [state, action, pending] = useActionState(renameItem, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);
  return (
    <Modal open={open} title="Rename" onClose={onClose}>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="id" value={item.id} />
        <TextField label="Name" name="name" required defaultValue={item.name} />
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" disabled={pending}>Save name</Button>
      </form>
    </Modal>
  );
}

function MoveDialog({
  item,
  folders,
  open,
  onClose,
}: {
  item: BrowserItem;
  folders: FolderChoice[];
  open: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(moveItem, {});
  const choices = folders.filter((folder) => folder.id !== item.id);
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);
  return (
    <Modal open={open} title="Move" onClose={onClose}>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="id" value={item.id} />
        <SelectField label="Destination" name="destinationId" required defaultValue={choices[0]?.id}>
          {choices.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {`${"· ".repeat(folder.depth)}${folder.name}`}
            </option>
          ))}
        </SelectField>
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" disabled={pending || choices.length === 0}>Move</Button>
      </form>
    </Modal>
  );
}

function ShareDialog({ item, open, onClose }: { item: BrowserItem; open: boolean; onClose: () => void }) {
  const [shareState, shareAction, sharePending] = useActionState(addShare, {});
  const [linkState, linkAction, linkPending] = useActionState(saveLink, {});
  const router = useRouter();
  useEffect(() => {
    if (shareState.ok || linkState.ok) router.refresh();
  }, [shareState.ok, linkState.ok, router]);

  return (
    <Modal open={open} title={`Share “${item.name}”`} onClose={onClose}>
      <div className="grid gap-5">
        <form action={shareAction} className="grid gap-3">
          <input type="hidden" name="id" value={item.id} />
          <TextField label="Email" name="email" type="email" required placeholder="name@example.com" />
          <SelectField label="Permission" name="permission" defaultValue="VIEW">
            <option value="VIEW">Can view</option>
            <option value="EDIT">Can edit</option>
          </SelectField>
          {shareState.error ? <p className="text-sm text-danger">{shareState.error}</p> : null}
          <Button type="submit" disabled={sharePending}>Share</Button>
        </form>
        {item.shares.length > 0 ? (
          <ul className="grid gap-2">
            {item.shares.map((share) => (
              <li key={share.id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{share.name}</p>
                  <p className="truncate text-xs text-muted">{share.email}</p>
                </div>
                <form action={setSharePermission} className="flex items-center gap-2">
                  <input type="hidden" name="shareId" value={share.id} />
                  <select name="permission" defaultValue={share.permission} className="rounded-lg border border-line bg-white px-2 py-1 text-xs" onChange={(event) => event.currentTarget.form?.requestSubmit()}>
                    <option value="VIEW">View</option>
                    <option value="EDIT">Edit</option>
                  </select>
                </form>
                <form action={deleteShare}>
                  <input type="hidden" name="shareId" value={share.id} />
                  <button type="submit" className="text-xs text-danger">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No one else has access yet.</p>
        )}
        <form action={linkAction} className="grid gap-3 border-t border-line pt-4">
          <input type="hidden" name="id" value={item.id} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={item.link?.enabled ?? false} />
            Anyone with the link
          </label>
          <SelectField label="Link permission" name="permission" defaultValue={item.link?.permission ?? "VIEW"}>
            <option value="VIEW">Can view</option>
            <option value="EDIT">Can edit</option>
          </SelectField>
          {item.link?.enabled ? (
            <p className="break-all rounded-xl bg-background px-3 py-2 text-xs">{item.link.url}</p>
          ) : null}
          {linkState.error ? <p className="text-sm text-danger">{linkState.error}</p> : null}
          <Button type="submit" variant="quiet" disabled={linkPending}>Save link</Button>
        </form>
      </div>
    </Modal>
  );
}

function DeleteDialog({ item, open, onClose }: { item: BrowserItem; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Delete forever" onClose={onClose}>
      <form action={deleteItem} className="grid gap-4">
        <input type="hidden" name="id" value={item.id} />
        <p className="text-sm text-muted">{item.name} and everything inside it will be removed.</p>
        <Button type="submit" variant="danger">Delete forever</Button>
      </form>
    </Modal>
  );
}
