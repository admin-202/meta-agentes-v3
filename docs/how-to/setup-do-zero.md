# Setup do zero — torne este template seu

Este projeto é uma **agência de tráfego Meta Ads operada por IAs**, entregue como
template genérico. Ele vem com um **cliente de exemplo** (`cliente-exemplo`) e dois
produtos de exemplo (`curso-exemplo`, `workshop-exemplo`) totalmente funcionais como
referência. Siga os passos abaixo para adaptá-lo ao seu negócio.

> Convenções do template (troque pelos seus): assistente de voz **Nexus**, marca/agência
> **Acme**, domínio **example.com**, npm scope **@template**, app Fly **meta-ads-agents**.

## 1. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha **todas** as chaves do `.env.example`. As obrigatórias para subir o básico:
`CLAUDE_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `AUTH_SECRET`,
`DASHBOARD_PASSWORD`. As demais são opcionais (degradam com elegância quando ausentes).

> ⚠️ Nunca commite `.env.local`. Se um segredo vazar, **rotacione** (não basta apagar).

## 2. Banco de dados (Supabase)

Aplique as migrations de `supabase/migrations/` no seu projeto Supabase (via Supabase CLI
ou MCP). Depois, **edite o seed do cliente** em
`supabase/migrations/20260530000003_seed_client_cliente_exemplo.sql` com os seus dados
reais (ou crie um novo seed para o seu cliente): `ad_account_id`, `business_manager_id`,
`facebook_page_id`, `default_landing_url`, `daily_budget_cap_cents`.

## 3. Conecte o MCP da Meta Ads

As skills usam um connector MCP chamado **`mcp-meta-ads`** (read + write na Marketing API).
Conecte o seu na API da Anthropic / Claude Code e garanta que o token da conta Meta esteja
válido. A autenticação do usuário acontece na vinculação do MCP (ver `CLAUDE.md`).

## 4. Crie o seu cliente (renomeie o exemplo)

O slug `cliente-exemplo` aparece em: nomes das 8 skills (`.claude/skills/*-cliente-exemplo-*`),
nos mapas allowlist do dashboard (`web/lib/nexus/tools.ts`, `web/lib/api/landing-pages.ts`),
no seed do DB e na pasta de materiais `.claude/materiais-das-empresas/cliente-exemplo/`.
Para criar o **seu** cliente, escolha um slug (`^[a-z0-9-]{2,40}$`) e:

1. Duplique/renomeie as pastas de skill trocando `cliente-exemplo` pelo seu slug.
2. Atualize as mesmas chaves nos dois mapas allowlist do `web/`.
3. Duplique `.claude/materiais-das-empresas/cliente-exemplo/` → `.../<seu-slug>/` e
   coloque seus assets (veja o `README.md` lá dentro) e briefs de produto.
4. Adicione o cliente no `lista-de-clientes` e os produtos no `lista-de-produtos`.
5. Garanta que o `slug` do seed no DB == slug das skills == nome da pasta de materiais.

## 5. Produtos e materiais

Cada produto tem um brief em `.claude/materiais-das-empresas/<cliente>/produtos/<slug>.json`
(use `curso-exemplo.json` como modelo) e uma entrada em
`.claude/skills/lista-de-produtos/SKILL.md`. Substitua todos os placeholders
(`<...>`, "Nome do Instrutor", `<META_PIXEL_ID>`, `<GA4_MEASUREMENT_ID>`, checkout, cores).

## 6. (Opcional) Renomeie a marca

- **Assistente** (`Nexus`): busque/troque `Nexus`/`nexus` se quiser outro nome.
- **Agência/marca** (`Acme`): idem.
- **Domínio** (`example.com`): troque pelo seu domínio nas configs do worker de tracking
  (`worker/track/wrangler.toml`), em `scripts/screenshot-page.cjs` e no `TRACK_ENDPOINT`.
- **Fly app** (`meta-ads-agents`) em `fly.toml`.

## 7. Rode

```bash
cd web && npm install && npm run dev      # dashboard (Nexus)
```

Para o runner headless no Fly e os crons, veja
[`deploying-fly-runner-from-scratch.md`](../tutorials/deploying-fly-runner-from-scratch.md)
e [`operations-runbook.md`](./operations-runbook.md).
