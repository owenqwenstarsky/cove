import { NextRequest } from "next/server";
import { contentDisposition } from "@/lib/http";
import { boot } from "@/lib/guards";
import { readableFile } from "@/lib/mutations";
import { getSettings } from "@/lib/settings";
import { readStoredFile } from "@/lib/storage";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const gate = await boot();
  if (gate.state === "db") return new Response("Database unavailable", { status: 503 });
  const link = request.nextUrl.searchParams.get("link");
  const item = await readableFile({
    userId: gate.state === "ready" ? gate.user?.id ?? null : null,
    linkToken: link,
    itemId: id,
  });
  if (!item?.storageKey) return new Response("Not found", { status: 404 });
  const settings = await getSettings();
  try {
    return new Response(readStoredFile(settings.uploadPath, item.storageKey), {
      headers: {
        "Content-Type": item.mimeType || "application/octet-stream",
        "Content-Disposition": contentDisposition(item.name),
        "Content-Length": item.sizeBytes.toString(),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
