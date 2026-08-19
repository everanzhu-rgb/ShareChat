import type { Attachment, JournalEntry } from "./types";

const ACCESS_KEY_STORAGE = "sharechat-cloud-access-key";
const CHUNK_BYTES = 4 * 1024 * 1024;

export function loadCloudAccessKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACCESS_KEY_STORAGE) ?? "";
}

export function saveCloudAccessKey(value: string): void {
  window.localStorage.setItem(ACCESS_KEY_STORAGE, value.trim());
}

export function clearCloudAccessKey(): void {
  window.localStorage.removeItem(ACCESS_KEY_STORAGE);
}

async function cloudFetch(
  accessKey: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-sharechat-key", accessKey);
  const response = await fetch(path, { ...init, headers, cache: "no-store" });
  if (response.status === 401) throw new Error("共同空间口令不正确");
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `云端请求失败（${response.status}）`);
  }
  return response;
}

export async function verifyCloudAccess(accessKey: string): Promise<void> {
  await cloudFetch(accessKey, "/api/entries?limit=1");
}

export async function loadCloudEntries(accessKey: string): Promise<JournalEntry[]> {
  const response = await cloudFetch(accessKey, "/api/entries?limit=200");
  const payload = (await response.json()) as { entries: JournalEntry[] };
  return payload.entries;
}

export async function saveCloudEntry(
  accessKey: string,
  entry: JournalEntry,
): Promise<void> {
  await cloudFetch(accessKey, "/api/entries", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entry),
  });
}

export async function deleteCloudEntry(
  accessKey: string,
  entryId: string,
): Promise<void> {
  await cloudFetch(accessKey, `/api/entries/${encodeURIComponent(entryId)}`, {
    method: "DELETE",
  });
}

export async function uploadCloudAttachment(
  accessKey: string,
  attachmentId: string,
  file: File,
  onProgress?: (completed: number, total: number) => void,
): Promise<Pick<Attachment, "cloudId" | "cloudState" | "mimeType" | "size" | "chunkCount">> {
  const chunkCount = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));

  for (let index = 0; index < chunkCount; index += 1) {
    const start = index * CHUNK_BYTES;
    const chunk = file.slice(start, Math.min(file.size, start + CHUNK_BYTES));
    await cloudFetch(accessKey, `/api/attachments/${attachmentId}/chunks/${index}`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: chunk,
    });
    onProgress?.(index + 1, chunkCount);
  }

  await cloudFetch(accessKey, `/api/attachments/${attachmentId}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name || "来自 iPhone 的附件",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      chunkCount,
    }),
  });

  return {
    cloudId: attachmentId,
    cloudState: "ready",
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    chunkCount,
  };
}

export async function loadCloudAttachmentPreview(
  accessKey: string,
  attachment: Attachment,
): Promise<string | undefined> {
  if (!attachment.cloudId || !attachment.mimeType?.startsWith("image/")) return undefined;
  const response = await cloudFetch(accessKey, `/api/attachments/${attachment.cloudId}`);
  return URL.createObjectURL(await response.blob());
}
