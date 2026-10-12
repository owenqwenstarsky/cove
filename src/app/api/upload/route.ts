import { NextRequest } from "next/server";
import { boot } from "@/lib/guards";
import { UserError, createUploadedFile } from "@/lib/mutations";

export async function POST(request: NextRequest) {
  const gate = await boot();
  if (gate.state === "db") {
    return Response.json({ error: "Postgres isn't reachable." }, { status: 503 });
  }
  if (gate.state === "setup") {
    return Response.json({ error: "Cove is not set up yet." }, { status: 403 });
  }
  const form = await request.formData();
  const file = form.get("file");
  const parentId = String(form.get("parentId") ?? "");
  const link = form.get("link");
  const linkToken = typeof link === "string" && link ? link : null;
  if (!gate.user && !linkToken) {
    return Response.json({ error: "Sign in to upload." }, { status: 401 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a file." }, { status: 400 });
  }
  try {
    await createUploadedFile({
      userId: gate.user?.id ?? "",
      parentId,
      name: file.name,
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
      linkToken,
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof UserError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return Response.json({ error: "Upload failed." }, { status: 500 });
  }
}
