"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-orange)]";
const labelClass = "block text-xs uppercase tracking-[0.1em] text-white/50";

export function AddClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [adAccountId, setAdAccountId] = useState("");
  const [businessManagerId, setBusinessManagerId] = useState("");
  const [facebookPageId, setFacebookPageId] = useState("");
  const [defaultLandingUrl, setDefaultLandingUrl] = useState("");
  const [dailyBudgetBrl, setDailyBudgetBrl] = useState("50");

  function reset() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setAdAccountId("");
    setBusinessManagerId("");
    setFacebookPageId("");
    setDefaultLandingUrl("");
    setDailyBudgetBrl("50");
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const budget = Number(dailyBudgetBrl.replace(",", "."));
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug || slugify(name),
          adAccountId: adAccountId.trim(),
          businessManagerId: businessManagerId.trim(),
          facebookPageId: facebookPageId.trim(),
          defaultLandingUrl: defaultLandingUrl.trim(),
          dailyBudgetCapCents: Math.round(budget * 100),
        }),
      });
      if (res.ok) {
        setOpen(false);
        reset();
        router.refresh();
        return;
      }
      if (res.status === 409) {
        setError("Já existe um cliente com esse slug ou ad_account_id.");
      } else if (res.status === 429) {
        setError("Muitas tentativas. Aguarde um pouco.");
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.issues?.[0]?.message ?? "Dados inválidos. Confira os campos.");
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tech-chip rounded px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-100 transition hover:bg-cyan-400/10"
      >
        + Adicionar cliente
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-[var(--color-navy-soft)] p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Novo cliente</h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="text-white/40 hover:text-white"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <label className={labelClass} htmlFor="client-name">
                Nome do cliente *
              </label>
              <input
                id="client-name"
                className={inputClass}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                required
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass} htmlFor="client-slug">
                Slug *
              </label>
              <input
                id="client-slug"
                className={inputClass}
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="ex.: viena-cacau"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                required
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass} htmlFor="client-ad-account">
                Ad Account ID (Meta) *
              </label>
              <input
                id="client-ad-account"
                className={inputClass}
                value={adAccountId}
                onChange={(e) => setAdAccountId(e.target.value)}
                placeholder="só números, sem o prefixo act_"
                inputMode="numeric"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass} htmlFor="client-bm">
                  Business Manager ID
                </label>
                <input
                  id="client-bm"
                  className={inputClass}
                  value={businessManagerId}
                  onChange={(e) => setBusinessManagerId(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass} htmlFor="client-page">
                  Facebook Page ID
                </label>
                <input
                  id="client-page"
                  className={inputClass}
                  value={facebookPageId}
                  onChange={(e) => setFacebookPageId(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass} htmlFor="client-url">
                URL da landing page
              </label>
              <input
                id="client-url"
                type="url"
                className={inputClass}
                value={defaultLandingUrl}
                onChange={(e) => setDefaultLandingUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass} htmlFor="client-budget">
                Orçamento máximo diário (R$) *
              </label>
              <input
                id="client-budget"
                className={inputClass}
                value={dailyBudgetBrl}
                onChange={(e) => setDailyBudgetBrl(e.target.value)}
                inputMode="decimal"
                required
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[var(--color-orange)] px-4 py-2 font-medium text-black transition disabled:opacity-50"
            >
              {submitting ? "Cadastrando…" : "Cadastrar cliente"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
