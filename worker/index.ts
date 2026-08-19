/** ShareChat Cloudflare Worker: Vinext app + authenticated D1/R2 sync API. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface D1Result<T = Record<string, unknown>> { results?: T[]; success: boolean }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
}
interface D1Database { prepare(query: string): D1Statement }
interface R2ObjectBody { body: ReadableStream<Uint8Array> }
interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | Blob): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
}
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Database;
  MEDIA: R2Bucket;
  SHARECHAT_ACCESS_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
type EntryRow = { payload_json: string };
type AttachmentRow = {
  id: string; filename: string; mime_type: string; byte_size: number;
  chunk_count: number; status: string;
};

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}
function authorized(request: Request, env: Env): boolean {
  const expected = env.SHARECHAT_ACCESS_KEY;
  const actual = request.headers.get("x-sharechat-key");
  return Boolean(expected && actual && expected.length >= 12 && actual === expected);
}
function safeId(value: string): boolean { return /^[a-zA-Z0-9_-]{8,120}$/.test(value) }

async function handleEntries(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === "GET") {
    const requestedLimit = Number(url.searchParams.get("limit") ?? 100);
    const limit = Math.max(1, Math.min(200, Number.isFinite(requestedLimit) ? requestedLimit : 100));
    const rows = await env.DB.prepare("SELECT payload_json FROM entries ORDER BY updated_at DESC LIMIT ?")
      .bind(limit).all<EntryRow>();
    const entries = (rows.results ?? []).flatMap((row) => {
      try { return [JSON.parse(row.payload_json)]; } catch { return []; }
    });
    return json({ entries });
  }
  if (request.method === "PUT") {
    const raw = await request.text();
    if (raw.length > 1_000_000) return json({ error: "手记内容过大" }, 413);
    let entry: Record<string, unknown>;
    try { entry = JSON.parse(raw) as Record<string, unknown>; }
    catch { return json({ error: "手记格式无效" }, 400); }
    const id = typeof entry.id === "string" ? entry.id : "";
    const updatedAt = typeof entry.updatedAt === "string" ? entry.updatedAt : new Date().toISOString();
    if (!safeId(id)) return json({ error: "手记编号无效" }, 400);
    await env.DB.prepare(
      `INSERT INTO entries (id, payload_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
       WHERE excluded.updated_at >= entries.updated_at`,
    ).bind(id, raw, updatedAt).run();
    await env.DB.prepare(
      "INSERT INTO sync_events (entity_type, entity_id, operation, created_at) VALUES ('entry', ?, 'upsert', ?)",
    ).bind(id, new Date().toISOString()).run();
    return json({ ok: true });
  }
  return json({ error: "Method not allowed" }, 405);
}

async function handleAttachment(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const segments = url.pathname.split("/").filter(Boolean);
  const id = segments[2] ?? "";
  if (!safeId(id)) return json({ error: "附件编号无效" }, 400);

  if (segments[3] === "chunks" && request.method === "PUT") {
    const index = Number(segments[4]);
    if (!Number.isInteger(index) || index < 0 || index > 4095 || !request.body) {
      return json({ error: "附件分块无效" }, 400);
    }
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 5 * 1024 * 1024) return json({ error: "单个附件分块超过 5 MB" }, 413);
    const objectKey = `private/${id}/chunks/${String(index).padStart(6, "0")}`;
    await env.MEDIA.put(objectKey, request.body);
    await env.DB.prepare(
      `INSERT INTO attachment_chunks (attachment_id, chunk_index, object_key, byte_size, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(attachment_id, chunk_index) DO UPDATE SET object_key = excluded.object_key, byte_size = excluded.byte_size`,
    ).bind(id, index, objectKey, Math.max(0, length), new Date().toISOString()).run();
    return json({ ok: true, index });
  }

  if (segments[3] === "complete" && request.method === "POST") {
    const metadata = (await request.json()) as { filename?: string; mimeType?: string; size?: number; chunkCount?: number };
    const chunkCount = Number(metadata.chunkCount);
    const size = Number(metadata.size);
    if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > 4096 || !Number.isFinite(size) || size < 0) {
      return json({ error: "附件信息无效" }, 400);
    }
    const uploaded = await env.DB.prepare("SELECT COUNT(*) AS count FROM attachment_chunks WHERE attachment_id = ?")
      .bind(id).first<{ count: number }>();
    if (Number(uploaded?.count ?? 0) !== chunkCount) return json({ error: "附件仍有分块未上传完成" }, 409);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO attachments (id, filename, mime_type, byte_size, chunk_count, status, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, 'ready', ?, ?)
       ON CONFLICT(id) DO UPDATE SET filename = excluded.filename, mime_type = excluded.mime_type,
         byte_size = excluded.byte_size, chunk_count = excluded.chunk_count, status = 'ready', completed_at = excluded.completed_at`,
    ).bind(id, String(metadata.filename ?? "附件").slice(0, 255),
      String(metadata.mimeType ?? "application/octet-stream").slice(0, 120), size, chunkCount, now, now).run();
    return json({ ok: true, id });
  }

  if (segments.length === 3 && request.method === "GET") {
    const metadata = await env.DB.prepare(
      "SELECT id, filename, mime_type, byte_size, chunk_count, status FROM attachments WHERE id = ?",
    ).bind(id).first<AttachmentRow>();
    if (!metadata || metadata.status !== "ready") return json({ error: "附件不存在" }, 404);
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    ctx.waitUntil((async () => {
      const writer = stream.writable.getWriter();
      try {
        for (let index = 0; index < metadata.chunk_count; index += 1) {
          const objectKey = `private/${id}/chunks/${String(index).padStart(6, "0")}`;
          const object = await env.MEDIA.get(objectKey);
          if (!object) throw new Error(`Missing attachment chunk ${index}`);
          const reader = object.body.getReader();
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            await writer.write(part.value);
          }
        }
        await writer.close();
      } catch (error) { await writer.abort(error); }
    })());
    const safeFilename = metadata.filename.replace(/["\\\r\n]/g, "_");
    return new Response(stream.readable, { headers: {
      "content-type": metadata.mime_type,
      "content-length": String(metadata.byte_size),
      "content-disposition": `inline; filename="${safeFilename}"`,
      "cache-control": "private, no-store",
    }});
  }
  return json({ error: "附件接口不存在" }, 404);
}

async function handleApi(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  if (url.pathname === "/api/health") {
    try {
      const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
      return json({ ok: row?.ok === 1, database: "D1", media: "R2" });
    } catch { return json({ ok: false, error: "Cloud bindings unavailable" }, 503); }
  }
  if (!authorized(request, env)) return json({ error: "共同空间口令不正确" }, 401);
  if (url.pathname === "/api/entries") return handleEntries(request, env, url);
  if (url.pathname.startsWith("/api/attachments/")) return handleAttachment(request, env, ctx, url);
  return json({ error: "API not found" }, 404);
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await handleApi(request, env, ctx, url); }
      catch (error) {
        console.error("ShareChat API error", error);
        return json({ error: "云端服务暂时不可用" }, 500);
      }
    }
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }
    return handler.fetch(request, env, ctx);
  },
};
export default worker;
