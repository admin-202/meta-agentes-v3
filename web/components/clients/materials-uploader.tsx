"use client";

import { useEffect, useState, type ChangeEvent } from "react";

type MaterialItem = { name: string; path: string; url: string };
type MaterialsBySlug = Record<string, MaterialItem[]>;

const CATEGORIES: Array<{ key: string; label: string; multiple: boolean; hint: string }> = [
  { key: "logo", label: "Logo", multiple: false, hint: "obrigatório pra ter referência visual" },
  { key: "foto-do-infoprodutor", label: "Foto de quem aparece no anúncio", multiple: false, hint: "opcional" },
  { key: "mascote", label: "Mascote", multiple: false, hint: "opcional" },
  { key: "exemplo-de-ads", label: "Exemplos de anúncios anteriores", multiple: true, hint: "opcional, até 3 usadas" },
];

type Staged = { file: File; previewUrl: string };

function CategorySection({
  slug,
  category,
  label,
  multiple,
  hint,
  items,
  onChanged,
}: {
  slug: string;
  category: string;
  label: string;
  multiple: boolean;
  hint: string;
  items: MaterialItem[];
  onChanged: () => void;
}) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    const next = Array.from(files).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setStaged((prev) => (multiple ? [...prev, ...next] : next));
    e.target.value = "";
  }

  function removeStaged(index: number) {
    setStaged((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function clearStaged() {
    for (const s of staged) URL.revokeObjectURL(s.previewUrl);
    setStaged([]);
  }

  async function onSave() {
    if (staged.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const { file } of staged) {
        const form = new FormData();
        form.set("file", file);
        const res = await fetch(`/api/client-materials/${slug}/${category}`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          if (res.status === 415) setError("Formato não suportado (use JPEG, PNG ou WEBP).");
          else if (res.status === 413) setError("Arquivo maior que 5MB.");
          else setError("Falha no upload. Tente novamente.");
          return;
        }
      }
      clearStaged();
      onChanged();
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(name: string) {
    await fetch(`/api/client-materials/${slug}/${category}/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    onChanged();
  }

  return (
    <div className="tech-panel space-y-3 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white/90">{label}</p>
          <p className="text-xs text-white/40">{hint}</p>
        </div>
        <label className="tech-chip cursor-pointer rounded px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-400/10">
          + Escolher
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={multiple}
            className="hidden"
            disabled={uploading}
            onChange={onFilesSelected}
          />
        </label>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {staged.length > 0 && (
        <div className="space-y-2 rounded-lg border border-dashed border-cyan-200/25 bg-cyan-400/[0.03] p-3">
          <p className="text-xs text-cyan-100/70">
            {staged.length} arquivo{staged.length > 1 ? "s" : ""} pronto{staged.length > 1 ? "s" : ""} pra salvar
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {staged.map((s, i) => (
              <div key={s.previewUrl} className="group relative aspect-square overflow-hidden rounded-lg border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.previewUrl} alt="pré-visualização" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeStaged(i)}
                  className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white/80 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/80"
                  aria-label="Remover da seleção"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={uploading}
              className="rounded-lg bg-[var(--color-orange)] px-3 py-1.5 text-xs font-medium text-black transition disabled:opacity-50"
            >
              {uploading ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={clearStaged}
              disabled={uploading}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:text-white disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.path} className="group relative aspect-square overflow-hidden rounded-lg border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={label} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onDelete(item.name)}
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white/80 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/80"
                aria-label="Remover"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MaterialsUploader({ slug }: { slug: string }) {
  const [materials, setMaterials] = useState<MaterialsBySlug>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/client-materials/${slug}`);
      if (res.ok) {
        const body = await res.json();
        setMaterials(body.materials ?? {});
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">Materiais de marca</h2>
      <p className="text-sm text-white/50">
        Usados pela IA como referência visual pra gerar criativos automáticos. Sem
        logo, os criativos saem sem identidade visual do cliente.
      </p>
      {loading ? (
        <p className="text-sm text-white/40">Carregando…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CATEGORIES.map((cat) => (
            <CategorySection
              key={cat.key}
              slug={slug}
              category={cat.key}
              label={cat.label}
              multiple={cat.multiple}
              hint={cat.hint}
              items={materials[cat.key] ?? []}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </section>
  );
}
