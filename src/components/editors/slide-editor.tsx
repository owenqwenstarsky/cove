"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { savePresentation } from "@/app/(workspace)/actions";
import type { SlideContent, SlideElement } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";

export function SlideEditor({
  id,
  initialTitle,
  initialContent,
  version,
  canEdit,
  linkToken,
}: {
  id: string;
  initialTitle: string;
  initialContent: SlideContent;
  version: number;
  canEdit: boolean;
  linkToken?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(content.slides[0]?.elements[0]?.id ?? null);
  const [presenting, setPresenting] = useState(false);
  const [status, setStatus] = useState(canEdit ? "Saved" : "View only");
  const versionRef = useRef(version);
  const skip = useRef(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const slide = content.slides[Math.min(slideIndex, content.slides.length - 1)];
  const selected = slide?.elements.find((element) => element.id === selectedId) ?? null;

  useEffect(() => {
    if (!canEdit) return;
    if (skip.current) {
      skip.current = false;
      return;
    }
    const handle = setTimeout(async () => {
      setStatus("Saving…");
      const result = await savePresentation({
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

  useEffect(() => {
    if (!presenting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPresenting(false);
      if (event.key === "ArrowRight") setSlideIndex((index) => Math.min(content.slides.length - 1, index + 1));
      if (event.key === "ArrowLeft") setSlideIndex((index) => Math.max(0, index - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, content.slides.length]);

  function updateSlide(elements: SlideElement[]) {
    setContent((current) => ({
      slides: current.slides.map((entry, index) => (index === slideIndex ? { ...entry, elements } : entry)),
    }));
  }

  function patchElement(elementId: string, patch: Partial<SlideElement>) {
    setContent((current) => ({
      slides: current.slides.map((entry, index) => {
        if (index !== slideIndex) return entry;
        return {
          ...entry,
          elements: entry.elements.map((element) => (element.id === elementId ? { ...element, ...patch } : element)),
        };
      }),
    }));
  }

  function onDrag(event: React.PointerEvent, element: SlideElement) {
    if (!canEdit || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = element.x;
    const originY = element.y;
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      patchElement(element.id, {
        x: clamp(originX + dx, 0, 100 - element.w),
        y: clamp(originY + dy, 0, 100 - element.h),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  if (!slide) return null;

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted">
        <Link href="/drive" className="hover:text-foreground">My Drive</Link>
        <span>{status}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={title}
          disabled={!canEdit}
          aria-label="Presentation title"
          onChange={(event) => setTitle(event.target.value)}
          className="min-w-0 flex-1 bg-transparent font-display text-4xl italic outline-none"
        />
        <Button type="button" variant="quiet" onClick={() => setPresenting(true)}>Present</Button>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[11rem_minmax(0,1fr)_16rem]">
        <div className="grid content-start gap-2">
          {content.slides.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setSlideIndex(index);
                setSelectedId(entry.elements[0]?.id ?? null);
              }}
              className={`rounded-xl border p-2 text-left text-xs ${index === slideIndex ? "border-copper bg-card" : "border-line bg-paper"}`}
            >
              <span className="text-muted">Slide {index + 1}</span>
              <span className="mt-1 block truncate">{entry.elements[0]?.text || "Empty"}</span>
            </button>
          ))}
          {canEdit ? (
            <Button
              type="button"
              variant="quiet"
              onClick={() => {
                const elementId = crypto.randomUUID();
                const slideId = crypto.randomUUID();
                setContent((current) => ({
                  slides: [
                    ...current.slides,
                    {
                      id: slideId,
                      background: "#fbf7f0",
                      elements: [
                        {
                          id: elementId,
                          type: "text",
                          x: 8,
                          y: 38,
                          w: 84,
                          h: 18,
                          text: "New slide",
                          fontSize: 36,
                          color: "#1c1915",
                          align: "center",
                          bold: true,
                        },
                      ],
                    },
                  ],
                }));
                setSlideIndex(content.slides.length);
                setSelectedId(elementId);
              }}
            >
              Add slide
            </Button>
          ) : null}
        </div>
        <div
          ref={canvasRef}
          className="relative aspect-video w-full overflow-hidden rounded-2xl border border-line shadow-sm"
          style={{ background: slide.background }}
          onPointerDown={() => setSelectedId(null)}
        >
          {slide.elements.map((element) => (
            <div
              key={element.id}
              onPointerDown={(event) => {
                event.stopPropagation();
                setSelectedId(element.id);
                onDrag(event, element);
              }}
              className={`absolute overflow-hidden whitespace-pre-wrap ${selectedId === element.id ? "ring-2 ring-copper" : ""}`}
              style={{
                left: `${element.x}%`,
                top: `${element.y}%`,
                width: `${element.w}%`,
                height: `${element.h}%`,
                color: element.color,
                fontSize: `${element.fontSize}px`,
                fontWeight: element.bold ? 700 : 400,
                textAlign: element.align,
                fontFamily: "var(--font-fraunces), serif",
              }}
            >
              {element.text}
            </div>
          ))}
        </div>
        <div className="grid content-start gap-3">
          {selected && canEdit ? (
            <>
              <TextAreaField label="Text" value={selected.text} onChange={(event) => patchElement(selected.id, { text: event.target.value })} />
              <label className="grid gap-1 text-sm">
                Font size
                <input type="number" min={12} max={96} value={selected.fontSize} onChange={(event) => patchElement(selected.id, { fontSize: Number(event.target.value) })} className="rounded-xl border border-line bg-white px-3 py-2" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.bold} onChange={(event) => patchElement(selected.id, { bold: event.target.checked })} />
                Bold
              </label>
              <label className="grid gap-1 text-sm">
                Align
                <select value={selected.align} onChange={(event) => patchElement(selected.id, { align: event.target.value as SlideElement["align"] })} className="rounded-xl border border-line bg-white px-3 py-2">
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Color
                <input type="color" value={selected.color} onChange={(event) => patchElement(selected.id, { color: event.target.value })} />
              </label>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  const element: SlideElement = {
                    id: crypto.randomUUID(),
                    type: "text",
                    x: 10,
                    y: 20,
                    w: 40,
                    h: 16,
                    text: "Text",
                    fontSize: 24,
                    color: "#1c1915",
                    align: "left",
                    bold: false,
                  };
                  updateSlide([...slide.elements, element]);
                  setSelectedId(element.id);
                }}
              >
                Add text
              </Button>
              <Button type="button" variant="danger" onClick={() => updateSlide(slide.elements.filter((element) => element.id !== selected.id))}>
                Remove text
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted">Select a text block to edit it.</p>
          )}
          {canEdit ? (
            <label className="grid gap-1 text-sm">
              Slide background
              <input
                type="color"
                value={slide.background}
                onChange={(event) => {
                  const background = event.target.value;
                  setContent((current) => ({
                    slides: current.slides.map((entry, index) => (index === slideIndex ? { ...entry, background } : entry)),
                  }));
                }}
              />
            </label>
          ) : null}
          {canEdit && content.slides.length > 1 ? (
            <Button
              type="button"
              variant="quiet"
              onClick={() => {
                setContent((current) => ({ slides: current.slides.filter((_, index) => index !== slideIndex) }));
                setSlideIndex((index) => Math.max(0, index - 1));
              }}
            >
              Delete slide
            </Button>
          ) : null}
        </div>
      </div>
      {presenting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141210] p-6 text-white" role="dialog" aria-label="Presentation">
          <button type="button" className="absolute top-4 right-4 text-sm text-white/70" onClick={() => setPresenting(false)}>
            Close
          </button>
          <div className="relative aspect-video w-full max-w-6xl" style={{ background: slide.background }}>
            {slide.elements.map((element) => (
              <div
                key={element.id}
                className="absolute overflow-hidden whitespace-pre-wrap"
                style={{
                  left: `${element.x}%`,
                  top: `${element.y}%`,
                  width: `${element.w}%`,
                  height: `${element.h}%`,
                  color: element.color,
                  fontSize: `${element.fontSize * 1.4}px`,
                  fontWeight: element.bold ? 700 : 400,
                  textAlign: element.align,
                  fontFamily: "var(--font-fraunces), serif",
                }}
              >
                {element.text}
              </div>
            ))}
          </div>
          <p className="absolute bottom-4 text-sm text-white/60">
            {slideIndex + 1} / {content.slides.length}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
