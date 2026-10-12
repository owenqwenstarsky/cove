import type { CellMap } from "@/lib/formulas";

export const emptyDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export type SheetTab = {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: CellMap;
};

export type SheetContent = {
  activeSheetId: string;
  sheets: SheetTab[];
};

export type SlideElement = {
  id: string;
  type: "text";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  bold: boolean;
};

export type Slide = {
  id: string;
  background: string;
  elements: SlideElement[];
};

export type SlideContent = {
  slides: Slide[];
};

export function emptySheet(): SheetContent {
  const id = crypto.randomUUID();
  return {
    activeSheetId: id,
    sheets: [{ id, name: "Sheet 1", rows: 40, cols: 12, cells: {} }],
  };
}

export function emptySlides(): SlideContent {
  return {
    slides: [
      {
        id: crypto.randomUUID(),
        background: "#fbf7f0",
        elements: [
          {
            id: crypto.randomUUID(),
            type: "text",
            x: 8,
            y: 32,
            w: 84,
            h: 16,
            text: "Title",
            fontSize: 44,
            color: "#1c1915",
            align: "center",
            bold: true,
          },
          {
            id: crypto.randomUUID(),
            type: "text",
            x: 14,
            y: 52,
            w: 72,
            h: 12,
            text: "Subtitle",
            fontSize: 20,
            color: "#6e665c",
            align: "center",
            bold: false,
          },
        ],
      },
    ],
  };
}

export function asDoc(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value) && (value as { type?: string }).type === "doc") {
    return value;
  }
  return emptyDoc;
}

export function asSheet(value: unknown): SheetContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptySheet();
  const content = value as SheetContent;
  if (!Array.isArray(content.sheets) || content.sheets.length === 0) return emptySheet();
  return content;
}

export function asSlides(value: unknown): SlideContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptySlides();
  const content = value as SlideContent;
  if (!Array.isArray(content.slides) || content.slides.length === 0) return emptySlides();
  return content;
}
