"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { saveDocument } from "@/app/(workspace)/actions";
import { Button } from "@/components/ui/button";

export function DocEditor({
  id,
  initialTitle,
  initialContent,
  version,
  canEdit,
  linkToken,
}: {
  id: string;
  initialTitle: string;
  initialContent: object;
  version: number;
  canEdit: boolean;
  linkToken?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(canEdit ? "Saved" : "View only");
  const versionRef = useRef(version);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: canEdit,
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false, autolink: true, defaultProtocol: "https" }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: "px-1" },
    },
  });

  useEffect(() => {
    if (!editor || !canEdit) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const persist = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        setStatus("Saving…");
        const result = await saveDocument({
          id,
          title,
          content: editor.getJSON(),
          version: versionRef.current,
          linkToken,
        });
        if (result.ok) {
          versionRef.current = result.version;
          setStatus("Saved");
        } else {
          setStatus(result.error);
        }
      }, 700);
    };
    editor.on("update", persist);
    return () => {
      editor.off("update", persist);
      if (timer) clearTimeout(timer);
    };
  }, [editor, canEdit, id, linkToken, title]);

  async function saveTitle(next: string) {
    if (!editor || !canEdit) return;
    setStatus("Saving…");
    const result = await saveDocument({
      id,
      title: next,
      content: editor.getJSON(),
      version: versionRef.current,
      linkToken,
    });
    if (result.ok) {
      versionRef.current = result.version;
      setStatus("Saved");
    } else {
      setStatus(result.error);
    }
  }

  function promptLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const next = window.prompt("Link address", previous ?? "https://");
    if (next === null) return;
    if (next.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: next.trim() }).run();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted">
        <Link href="/drive" className="hover:text-foreground">My Drive</Link>
        <span>{status}</span>
      </div>
      <input
        value={title}
        disabled={!canEdit}
        aria-label="Document title"
        onChange={(event) => setTitle(event.target.value)}
        onBlur={(event) => void saveTitle(event.target.value)}
        className="w-full bg-transparent font-display text-5xl italic outline-none placeholder:text-muted"
      />
      <div className="mt-4 flex flex-wrap gap-1">
        <ToolbarButton label="Bold" disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive("bold")} />
        <ToolbarButton label="Italic" disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive("italic")} />
        <ToolbarButton label="H1" disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive("heading", { level: 1 })} />
        <ToolbarButton label="H2" disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive("heading", { level: 2 })} />
        <ToolbarButton label="List" disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive("bulletList")} />
        <ToolbarButton label="Numbered" disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive("orderedList")} />
        <ToolbarButton label="Link" disabled={!editor} onClick={promptLink} active={editor?.isActive("link")} />
        <ToolbarButton
          label="Table"
          disabled={!editor}
          onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        />
      </div>
      <div className="cove-doc mt-4 rounded-3xl bg-card px-6 py-8 shadow-[0_1px_0_rgba(28,25,21,0.04)] sm:px-10">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  active,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Button type="button" variant={active ? "primary" : "quiet"} disabled={disabled} onClick={onClick} className="px-3 py-1.5">
      {label}
    </Button>
  );
}
