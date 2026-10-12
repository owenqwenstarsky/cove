"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveSpreadsheet } from "@/app/(workspace)/actions";
import type { SheetContent, SheetTab } from "@/lib/content";
import { columnLabel, evaluateCell } from "@/lib/formulas";
import { Button } from "@/components/ui/button";

export function SheetEditor({
  id,
  initialTitle,
  initialContent,
  version,
  canEdit,
  linkToken,
}: {
  id: string;
  initialTitle: string;
  initialContent: SheetContent;
  version: number;
  canEdit: boolean;
  linkToken?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState(canEdit ? "Saved" : "View only");
  const initialTab = initialContent.sheets.find((sheet) => sheet.id === initialContent.activeSheetId) ?? initialContent.sheets[0];
  const [selected, setSelected] = useState("A1");
  const [draft, setDraft] = useState(initialTab?.cells.A1?.formula ?? initialTab?.cells.A1?.value ?? "");
  const versionRef = useRef(version);
  const skip = useRef(true);
  const tab = content.sheets.find((sheet) => sheet.id === content.activeSheetId) ?? content.sheets[0];

  const computed = useMemo(() => {
    const map: Record<string, string> = {};
    for (let row = 1; row <= tab.rows; row += 1) {
      for (let col = 1; col <= tab.cols; col += 1) {
        const key = `${columnLabel(col)}${row}`;
        const cell = tab.cells[key];
        if (!cell) continue;
        map[key] = evaluateCell(tab.cells, key);
      }
    }
    return map;
  }, [tab]);

  useEffect(() => {
    if (!canEdit) return;
    if (skip.current) {
      skip.current = false;
      return;
    }
    const handle = setTimeout(async () => {
      setStatus("Saving…");
      const result = await saveSpreadsheet({
        id,
        title,
        content,
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
    return () => clearTimeout(handle);
  }, [canEdit, content, id, linkToken, title]);

  function selectCell(key: string) {
    commitDraft();
    const cell = tab.cells[key];
    setSelected(key);
    setDraft(cell?.formula ?? cell?.value ?? "");
  }

  function commitDraft(nextDraft = draft, key = selected) {
    if (!canEdit) return;
    const raw = nextDraft.trim();
    setContent((current) => ({
      ...current,
      sheets: current.sheets.map((sheet) => {
        if (sheet.id !== tab.id) return sheet;
        const cells = { ...sheet.cells };
        if (!raw) delete cells[key];
        else if (raw.startsWith("=")) cells[key] = { formula: raw };
        else cells[key] = { value: raw };
        return { ...sheet, cells };
      }),
    }));
  }

  function updateTab(patch: Partial<SheetTab>) {
    setContent((current) => ({
      ...current,
      sheets: current.sheets.map((sheet) => (sheet.id === tab.id ? { ...sheet, ...patch } : sheet)),
    }));
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted">
        <Link href="/drive" className="hover:text-foreground">My Drive</Link>
        <span>{status}</span>
      </div>
      <input
        value={title}
        disabled={!canEdit}
        aria-label="Spreadsheet title"
        onChange={(event) => setTitle(event.target.value)}
        className="w-full bg-transparent font-display text-4xl italic outline-none"
      />
      <label className="mt-4 grid gap-1 text-sm">
        <span className="text-muted">{selected}</span>
        <input
          value={draft}
          disabled={!canEdit}
          aria-label="Formula bar"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commitDraft()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
          placeholder="Value or formula, such as =SUM(A1:A10)"
          className="rounded-xl border border-line bg-card px-3 py-2 outline-none ring-copper/30 focus:ring-2"
        />
      </label>
      <p className="mt-2 text-xs text-muted">Formulas start with =. SUM, AVERAGE, MIN, MAX, and COUNT accept ranges like A1:A10.</p>
      <div className="mt-4 max-h-[calc(100vh-18rem)] overflow-auto rounded-2xl border border-line bg-card">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-12 bg-[#f6f0e6] p-2" />
              {Array.from({ length: tab.cols }, (_, index) => (
                <th key={index} className="min-w-28 border-b border-l border-line bg-[#f6f0e6] px-2 py-1 font-medium">
                  {columnLabel(index + 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: tab.rows }, (_, rowIndex) => {
              const row = rowIndex + 1;
              return (
                <tr key={row}>
                  <th className="sticky left-0 border-t border-line bg-[#f6f0e6] px-2 py-1 text-center font-medium">{row}</th>
                  {Array.from({ length: tab.cols }, (_, colIndex) => {
                    const key = `${columnLabel(colIndex + 1)}${row}`;
                    const shown = key === selected ? draft : (computed[key] ?? "");
                    const error = shown.startsWith("#");
                    return (
                      <td key={key} className="border-t border-l border-line p-0">
                        <button
                          type="button"
                          className={`block h-8 w-full truncate px-2 text-left ${key === selected ? "ring-2 ring-inset ring-copper" : ""} ${error ? "sheet-error" : ""}`}
                          onClick={() => selectCell(key)}
                        >
                          {shown}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {content.sheets.map((sheet) => (
          <button
            key={sheet.id}
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${sheet.id === tab.id ? "bg-sidebar text-sidebar-foreground" : "bg-paper ring-1 ring-line"}`}
            onClick={() => {
              commitDraft();
              setContent((current) => ({ ...current, activeSheetId: sheet.id }));
            }}
          >
            {sheet.name}
          </button>
        ))}
        {canEdit ? (
          <>
            <Button
              type="button"
              variant="quiet"
              onClick={() => {
                const sheetId = crypto.randomUUID();
                setContent((current) => ({
                  activeSheetId: sheetId,
                  sheets: [...current.sheets, { id: sheetId, name: `Sheet ${current.sheets.length + 1}`, rows: 40, cols: 12, cells: {} }],
                }));
              }}
            >
              Add sheet
            </Button>
            <Button type="button" variant="quiet" onClick={() => updateTab({ rows: tab.rows + 5 })}>Add rows</Button>
            <Button type="button" variant="quiet" onClick={() => updateTab({ cols: tab.cols + 2 })}>Add columns</Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
