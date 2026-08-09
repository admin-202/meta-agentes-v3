import { Hono } from "hono";
import { db } from "@/lib/db/client";
import { rateLimiters, enforceLimit, clientIp } from "@/lib/ratelimit";

// Uploads/lists/deletes brand materials (logo, spokesperson photo, mascot, past ad
// examples) for a client, in the public `client-materials` bucket. The Fly.io runner
// (a different machine from this dashboard) syncs these down into
// `.claude/materiais-das-empresas/<name>/<category>/` before generating creatives —
// see create-traffic-campaign/SKILL.md §3.

const BUCKET = "client-materials";
const MAX_ASSET_BYTES = 5_000_000; // 5MB
// Raster only — no SVG (the bucket is public; a hostile SVG would execute at its origin).
const ASSET_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const CATEGORIES = new Set(["logo", "foto-do-infoprodutor", "mascote", "exemplo-de-ads"]);

export const clientMaterials = new Hono();

async function resolveClientId(slug: string): Promise<string | null> {
  const res = await db().from("clients").select("id").eq("slug", slug).maybeSingle();
  if (res.error) throw res.error;
  return res.data?.id ?? null;
}

// ---------- List materials for a client (grouped by category) ----------
clientMaterials.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const clientId = await resolveClientId(slug);
  if (!clientId) return c.json({ error: "client_not_found" }, 404);

  const supabase = db();
  const byCategory: Record<string, Array<{ name: string; path: string; url: string }>> = {};
  for (const category of CATEGORIES) {
    const list = await supabase.storage.from(BUCKET).list(`${slug}/${category}`, {
      sortBy: { column: "created_at", order: "desc" },
    });
    if (list.error) continue;
    byCategory[category] = (list.data ?? [])
      .filter((f) => f.name && !f.name.startsWith("."))
      .map((f) => {
        const path = `${slug}/${category}/${f.name}`;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return { name: f.name, path, url: data.publicUrl };
      });
  }
  return c.json({ materials: byCategory });
});

// ---------- Upload a material ----------
clientMaterials.post("/:slug/:category", async (c) => {
  const { allowed } = await enforceLimit(rateLimiters.clientCreation(), clientIp(c.req.raw), "client-materials-upload");
  if (!allowed) return c.json({ error: "rate_limited" }, 429, { "Retry-After": "60" });

  const slug = c.req.param("slug");
  const category = c.req.param("category");
  if (!CATEGORIES.has(category)) return c.json({ error: "invalid_category" }, 400);

  const clientId = await resolveClientId(slug);
  if (!clientId) return c.json({ error: "client_not_found" }, 404);

  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return c.json({ error: "invalid_request" }, 400);
  if (file.size === 0 || file.size > MAX_ASSET_BYTES) return c.json({ error: "file_too_large" }, 413);
  if (!ASSET_MIME.has(file.type)) return c.json({ error: "unsupported_media_type" }, 415);

  const supabase = db();
  const ext = file.type.split("/")[1] ?? "bin";
  const path = `${slug}/${category}/${Date.now()}-${Math.round(crypto.getRandomValues(new Uint32Array(1))[0]!)}.${ext}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  const up = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: file.type, upsert: false });
  if (up.error) {
    console.error(JSON.stringify({ level: "error", event: "material_upload_failed", message: up.error.message }));
    return c.json({ error: "upload_failed" }, 502);
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return c.json({ ok: true, url: data.publicUrl, path }, 201);
});

// ---------- Delete a material ----------
clientMaterials.delete("/:slug/:category/:filename", async (c) => {
  const { slug, category, filename } = c.req.param();
  if (!CATEGORIES.has(category)) return c.json({ error: "invalid_category" }, 400);
  const clientId = await resolveClientId(slug);
  if (!clientId) return c.json({ error: "client_not_found" }, 404);

  const del = await db().storage.from(BUCKET).remove([`${slug}/${category}/${filename}`]);
  if (del.error) {
    console.error(JSON.stringify({ level: "error", event: "material_delete_failed", message: del.error.message }));
    return c.json({ error: "delete_failed" }, 502);
  }
  return c.json({ ok: true });
});
