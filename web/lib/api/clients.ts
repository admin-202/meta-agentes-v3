import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { rateLimiters, enforceLimit, clientIp } from "@/lib/ratelimit";

// Onboards a new client (agency-managed ad account) from the dashboard. Mirrors the
// shape the Fly.io skills expect in `clients` (ADR 0002) — this is the ONLY UI path
// that writes this table; skills read it by slug, never create it themselves.

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createClientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80).regex(slugRe, "use apenas letras minusculas, numeros e hifens"),
  adAccountId: z.string().trim().regex(/^\d+$/, "apenas digitos"),
  businessManagerId: z.string().trim().regex(/^\d+$/).optional().or(z.literal("")),
  facebookPageId: z.string().trim().regex(/^\d+$/).optional().or(z.literal("")),
  defaultLandingUrl: z.string().trim().url().optional().or(z.literal("")),
  dailyBudgetCapCents: z.number().int().positive(),
  currency: z.string().trim().length(3).default("BRL"),
  materialsPath: z.string().trim().max(200).optional().or(z.literal("")),
});

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505";
}

export const clients = new Hono();

// ---------- Create a client ----------
clients.post("/", async (c) => {
  const { allowed } = await enforceLimit(rateLimiters.clientCreation(), clientIp(c.req.raw), "client-creation");
  if (!allowed) return c.json({ error: "rate_limited" }, 429, { "Retry-After": "3600" });

  const parsed = createClientSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_request", issues: parsed.error.issues }, 400);
  const data = parsed.data;

  const materialsPath = data.materialsPath || `.claude/materiais-das-empresas/${data.name}/`;

  const insert = await db()
    .from("clients")
    .insert({
      slug: data.slug,
      name: data.name,
      ad_account_id: data.adAccountId,
      business_manager_id: data.businessManagerId || null,
      facebook_page_id: data.facebookPageId || null,
      default_landing_url: data.defaultLandingUrl || null,
      daily_budget_cap_cents: data.dailyBudgetCapCents,
      currency: data.currency,
      materials_path: materialsPath,
    })
    .select("id, slug, name")
    .single();

  if (insert.error) {
    if (isUniqueViolation(insert.error)) {
      return c.json({ error: "already_exists" }, 409);
    }
    console.error(JSON.stringify({ level: "error", event: "client_create_failed", message: insert.error.message }));
    return c.json({ error: "create_failed" }, 502);
  }

  const log = await db()
    .from("operation_logs")
    .insert({
      client_id: insert.data.id,
      entity_type: "client",
      entity_id: insert.data.id,
      action: "create",
      actor: "operator",
      summary: `Cliente "${insert.data.name}" cadastrado via dashboard.`,
    });
  if (log.error) {
    console.error(JSON.stringify({ level: "error", event: "client_oplog_failed", message: log.error.message }));
  }

  return c.json({ client: insert.data }, 201);
});
