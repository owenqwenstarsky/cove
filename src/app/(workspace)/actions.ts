"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import type { ItemKind, Permission } from "@prisma/client";
import type { ActionState } from "@/lib/action-state";
import { boot } from "@/lib/guards";
import {
  UserError,
  changeShare,
  createEntry,
  deleteOwned,
  moveOwned,
  removeShare,
  renameOwnedOrEditable,
  restoreOwned,
  saveItemContent,
  setStarred,
  shareWithEmail,
  trashOwned,
  updateShareLink,
} from "@/lib/mutations";
import { cleanEmail } from "@/lib/validate";

async function actor() {
  const gate = await boot();
  if (gate.state === "setup") redirect("/setup");
  if (gate.state !== "ready" || !gate.user) redirect("/login");
  return gate.user;
}

function failure(error: unknown): ActionState {
  unstable_rethrow(error);
  if (error instanceof UserError) return { error: error.message };
  console.error(error);
  return { error: "Something went wrong." };
}

function refresh() {
  revalidatePath("/drive", "layout");
  revalidatePath("/admin", "layout");
}

export async function createFolder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actor();
  try {
    await createEntry(user.id, String(formData.get("parentId") ?? ""), "FOLDER", String(formData.get("name") ?? ""));
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

async function openCreated(kind: Exclude<ItemKind, "FILE" | "FOLDER">, formData: FormData, href: (id: string) => string) {
  const user = await actor();
  try {
    const item = await createEntry(user.id, String(formData.get("parentId") ?? ""), kind);
    refresh();
    redirect(href(item.id));
  } catch (error) {
    return failure(error);
  }
}

export async function createDocument(_prev: ActionState, formData: FormData) {
  return openCreated("DOCUMENT", formData, (id) => `/docs/${id}`);
}

export async function createSpreadsheet(_prev: ActionState, formData: FormData) {
  return openCreated("SPREADSHEET", formData, (id) => `/sheets/${id}`);
}

export async function createPresentation(_prev: ActionState, formData: FormData) {
  return openCreated("PRESENTATION", formData, (id) => `/slides/${id}`);
}

export async function renameItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actor();
  try {
    await renameOwnedOrEditable(user.id, String(formData.get("id") ?? ""), String(formData.get("name") ?? ""));
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function moveItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actor();
  try {
    await moveOwned(user.id, String(formData.get("id") ?? ""), String(formData.get("destinationId") ?? ""));
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function starItem(formData: FormData) {
  const user = await actor();
  await setStarred(user.id, String(formData.get("id") ?? ""), formData.get("starred") === "true");
  refresh();
}

export async function trashItem(formData: FormData) {
  const user = await actor();
  await trashOwned(user.id, String(formData.get("id") ?? ""));
  refresh();
}

export async function restoreItem(formData: FormData) {
  const user = await actor();
  await restoreOwned(user.id, String(formData.get("id") ?? ""));
  refresh();
}

export async function deleteItem(formData: FormData) {
  const user = await actor();
  await deleteOwned(user.id, String(formData.get("id") ?? ""));
  refresh();
}

function permissionOf(value: FormDataEntryValue | null): Permission {
  return value === "EDIT" ? "EDIT" : "VIEW";
}

export async function addShare(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actor();
  const email = cleanEmail(formData.get("email"));
  if (!email) return { error: "Enter the person's email." };
  try {
    await shareWithEmail(user.id, String(formData.get("id") ?? ""), email, permissionOf(formData.get("permission")));
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setSharePermission(formData: FormData) {
  const user = await actor();
  await changeShare(user.id, String(formData.get("shareId") ?? ""), permissionOf(formData.get("permission")));
  refresh();
}

export async function deleteShare(formData: FormData) {
  const user = await actor();
  await removeShare(user.id, String(formData.get("shareId") ?? ""));
  refresh();
}

export async function saveLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actor();
  try {
    await updateShareLink(
      user.id,
      String(formData.get("id") ?? ""),
      formData.get("enabled") === "on",
      permissionOf(formData.get("permission")),
    );
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

async function currentUserId() {
  const gate = await boot();
  if (gate.state !== "ready") return null;
  return gate.user?.id ?? null;
}

export async function saveDocument(input: {
  id: string;
  title: string;
  content: unknown;
  version: number;
  linkToken?: string;
}) {
  return saveKind("DOCUMENT", input);
}

export async function saveSpreadsheet(input: {
  id: string;
  title: string;
  content: unknown;
  version: number;
  linkToken?: string;
}) {
  return saveKind("SPREADSHEET", input);
}

export async function savePresentation(input: {
  id: string;
  title: string;
  content: unknown;
  version: number;
  linkToken?: string;
}) {
  return saveKind("PRESENTATION", input);
}

async function saveKind(
  kind: ItemKind,
  input: { id: string; title: string; content: unknown; version: number; linkToken?: string },
) {
  const userId = await currentUserId();
  if (!userId && !input.linkToken) return { ok: false as const, error: "Sign in to edit." };
  try {
    const version = await saveItemContent({
      userId,
      linkToken: input.linkToken,
      itemId: input.id,
      kind,
      title: input.title,
      content: input.content,
      version: input.version,
    });
    revalidatePath("/drive", "layout");
    return { ok: true as const, version };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof UserError) return { ok: false as const, error: error.message };
    console.error(error);
    return { ok: false as const, error: "The file couldn't be saved." };
  }
}
