---
name: create-traffic-campaign
description: Cria de forma 100% autônoma e headless uma campanha de tráfego Meta Ads (CBO, Advantage+) para QUALQUER cliente cadastrado na tabela `clients` do Supabase (via o botão "Adicionar cliente" do dashboard ou skill lista-de-clientes) — scrape da landing, geração de 3 criativos a partir dos materiais do cliente, campanha + adset + 3 ads PAUSED via MCP da Meta, persistência no Supabase e manifest. Recebe `client=<slug>` obrigatório. Use quando pedirem "criar campanha de tráfego para <cliente>", ou disparada headless (`claude -p --dangerously-skip-permissions ".claude/skills/create-traffic-campaign client=<slug>"`).
argument-hint: "client=<slug> [url=https://...] [budget-cents=<n>] [optimization=LANDING_PAGE_VIEWS] [n-creatives=3]"
allowed-tools: Read, Bash, Glob, Write, Agent, mcp__claude_ai_Meta_Ads_MCP__ads_get_ad_accounts, mcp__claude_ai_Meta_Ads_MCP__ads_get_ad_account_pages, mcp__claude_ai_Meta_Ads_MCP__ads_create_campaign, mcp__claude_ai_Meta_Ads_MCP__ads_create_ad_set, mcp__claude_ai_Meta_Ads_MCP__ads_create_ad, mcp__claude_ai_Meta_Ads_MCP__ads_update_entity, mcp__claude_ai_Meta_Ads_MCP__ads_get_errors, mcp__claude_ai_Meta_Ads_MCP__ads_get_ad_entities, mcp__claude_ai_Meta_Ads_MCP__ads_get_field_context, mcp__supabase__execute_sql, mcp__supabase__list_tables
---

# Skill: /create-traffic-campaign — genérica, multi-cliente

Versão **generalizada** de `create-traffic-viena-cacau-campaign` /
`create-traffic-cliente-exemplo-campaign`: em vez de hardcodar conta, orçamento e
materiais de UM cliente, esta skill **lê tudo em runtime** a partir de `client=<slug>`
— a tabela `clients` (Supabase) e a pasta `.claude/materiais-das-empresas/<Nome>/`.
Qualquer cliente cadastrado pelo botão "+ Adicionar cliente" do dashboard (ou por
`lista-de-clientes/SKILL.md`) funciona aqui **sem editar código**, desde que a pasta
de materiais tenha pelo menos um material de referência.

> É o contrato que o runner Fly.io dispara headless. Toda a inteligência está aqui;
> o runner é casca fina (`claude -p --dangerously-skip-permissions
> ".claude/skills/create-traffic-campaign client=<slug>"`).

---

## 1. Modo de operação — AUTONOMIA TOTAL (leia primeiro)

1. **NUNCA chame `AskUserQuestion`.** Decida sozinho com os defaults da §3, registre a
   decisão no manifest e siga. Só aborte se for impossível prosseguir sem gastar verba
   ou violar um limite duro — grave o manifest com `verified:false` explicando.
2. **Resolva erros por conta própria** (`ads_get_errors`, `ads_get_field_context`).
3. **`client=<slug>` é obrigatório.** Sem ele (ou se o slug não existir em `clients`),
   grave manifest `rejected:true` e pare — nunca invente um cliente.
4. **Meta só via MCP da Meta. Persista tudo no Supabase via MCP.**
5. **Limites duros (defesa em profundidade):**
   - Orçamento ≤ `clients.daily_budget_cap_cents` **do cliente resolvido**. Nunca use um
     valor fixo de outro cliente; nunca exceda o cap mesmo se um argumento pedir mais.
   - **Tudo nasce PAUSED. NUNCA** chame `ads_activate_entity`.
   - Prefira **reusar** criativos já gerados hoje (mesmo cliente) a regerar.

---

## 2. Passo 0 — Resolver o cliente (sempre primeiro)

```sql
select id, slug, name, ad_account_id, business_manager_id, facebook_page_id,
       default_landing_url, daily_budget_cap_cents, currency, materials_path
from clients where slug = '<client>';
```

- **Não encontrado** → manifest `rejected:true`, `reason:"cliente '<slug>' não existe em clients"`, pare.
- **`default_landing_url` ausente ou placeholder** (contém `example.com` ou
  `cliente-site.io`, ou é nulo) **e** nenhum `url=` foi passado como argumento →
  manifest `rejected:true`, `reason:"landing URL real não confirmada para este cliente — atualize clients.default_landing_url ou passe url=<real>"`, pare. **Nunca** crie
  campanha de verdade apontando pra um placeholder.
- Guarde `client_id` (uuid), `ad_account_id`, `business_manager_id`, `facebook_page_id`,
  `daily_budget_cap_cents`, `materials_path`, `name`. **Nunca hardcode nenhum destes.**

`budget_cents_final = min(override de budget-cents (se veio), daily_budget_cap_cents)`.
Se `budget-cents` do argumento exceder o cap do cliente, **clampe** silenciosamente e
anote a decisão no manifest — nunca ultrapasse o cap.

---

## 3. Passo 1 — Descobrir materiais de referência (dinâmico, sem lista fixa)

`MATERIALS_DIR="<materials_path>"` (do banco, com espaços/acentos do nome do cliente
— sempre citar entre aspas no Bash).

**Sincronize primeiro do bucket `client-materials`** (é lá que o dashboard salva o
que o operador sobe via upload na tela da cliente — este runner e o dashboard rodam
em máquinas diferentes, então o arquivo só chega aqui via Supabase Storage). Para
cada categoria (`logo`, `foto-do-infoprodutor` dentro de `logo/`, `mascote`,
`exemplo-de-ads`):
```bash
mkdir -p "${MATERIALS_DIR}/logo/foto-do-infoprodutor" "${MATERIALS_DIR}/mascote" "${MATERIALS_DIR}/exemplo-de-ads"
for CATEGORY in logo mascote exemplo-de-ads; do
  OBJECTS=$(curl -sS -X POST "${SUPABASE_URL}/storage/v1/object/list/client-materials" \
    -H "Authorization: Bearer ${SUPABASE_SECRET_KEY}" -H "Content-Type: application/json" \
    -d "{\"prefix\":\"<slug>/${CATEGORY}/\"}")
  echo "$OBJECTS" | jq -r '.[].name' | while read -r NAME; do
    [ -z "$NAME" ] && continue
    curl -sS -o "${MATERIALS_DIR}/${CATEGORY}/${NAME}" \
      "${SUPABASE_URL}/storage/v1/object/public/client-materials/<slug>/${CATEGORY}/${NAME}"
  done
done
```
(`foto-do-infoprodutor` fica dentro de `logo/` no filesystem local por convenção —
liste o prefixo `<slug>/foto-do-infoprodutor/` à parte e baixe pra
`${MATERIALS_DIR}/logo/foto-do-infoprodutor/`.) Isso **mescla** com o que já existir
localmente (não apaga nada) — idempotente, seguro rodar toda vez.

Depois de sincronizar, monte a lista de refs visuais **na ordem**, usando **o que
existir** (não é erro faltar algum item):

1. `${MATERIALS_DIR}/logo/logo.*` (1 arquivo)
2. `${MATERIALS_DIR}/logo/foto-do-infoprodutor/*` (0-1 arquivo — foto de quem aparece no anúncio, se houver)
3. `${MATERIALS_DIR}/mascote/*` (0-1 arquivo)
4. `${MATERIALS_DIR}/exemplo-de-ads/*` (0-3 arquivos — estilo visual de anúncios anteriores)

Use `Glob` para cada padrão. Cap total em **6 refs** (se houver mais em
`exemplo-de-ads/`, pegue as 3 mais recentes por mtime). **Se a lista ficar vazia**
(pasta sem nenhum material ainda), **não bloqueie** — prossiga sem refs visuais, mas
registre `"refs": []` e `"warning": "cliente sem materiais de referência — criativo gerado só a partir do scrape da landing"` no manifest. Recomende ao operador subir ao
menos um logo antes da próxima run.

Se existir `${MATERIALS_DIR}/produtos/*.json` (catálogo de produto, opcional), leia o
primeiro e use como contexto extra de copy (dores, oferta, preço, persona) — **não é
obrigatório**; na ausência, a copy vem só do scrape da landing (§4).

---

## 4. Passo 2 — Criativos (gerar fresco + reusar SOMENTE no mesmo dia)

`DATE=$(TZ=America/Sao_Paulo date +%F)`, `ADS_DIR="${MATERIALS_DIR}/generated-ads/${DATE}"`.

**Idempotência do dia**: se `${ADS_DIR}` já tem `ad-v1-autoridade.png`,
`ad-v2-dor.png`, `ad-v3-oferta.png` e `public-urls.txt` → reuse (leia URLs + copy),
pule pro Passo 3. Insira 1 `agent_events` sintético (mesmo padrão de
`create-traffic-cliente-exemplo-campaign` §Passo 2) pra não cegar o HUD ao vivo.

Senão, rode a cadeia completa pros 3 ângulos (**autoridade**, **dor**, **oferta**):

1. `Agent(subagent_type="scrape-extractor")` com a landing URL resolvida (`url=`
   override ou `default_landing_url`) → `scrape.json`.
2. Por ângulo, em paralelo:
   - `Agent(subagent_type="copywriter")` com `{scrape, objective:"OUTCOME_TRAFFIC",
     configHints:{brandName:<clients.name>, angle:<ângulo>}}` → headline (≤40),
     primaryText (≤250), description (≤30), `callToActionType:"LEARN_MORE"` (as 3
     variantes usam `LEARN_MORE` — CTA universalmente seguro entre nichos).
   - `Agent(subagent_type="image-prompt-generator")` com `{scrape, aspectRatio:"1080x1080",
     referenceImagePaths:<refs do Passo 1, na ordem, pode ser lista vazia>,
     configHints:{brandName:<clients.name>}}` → `prompt`. **Sem paleta/mascote
     hardcoded** — o agente infere estilo visual do scrape + das refs (se houver).
   - `Skill(skill="image-generate", args="prompt-file=<prompt> aspect=1:1
     refs=<refs, se houver, separadas por vírgula> out-dir=${ADS_DIR}
     out-name=ad-v<N>-<ângulo>")` → PNG 1024×1024. Salve `prompt-vN.txt`, `log-vN.txt`.
   - **Gate visual antes do upload**: `Read` o PNG e confira legibilidade da headline e
     presença de CTA. Se ilegível, regere 1× (mesmo prompt); se falhar de novo,
     prossiga com a melhor tentativa e anote o desvio no manifest.
3. **Upload para o bucket público `ad-ingest`** (Meta não baixa bucket privado — ADR
   0003). Para cada PNG, `RAND=$(openssl rand -hex 10)`:
   ```bash
   PREFIX="<slug>/${DATE}/${RAND}"
   curl -sS -X POST "${SUPABASE_URL}/storage/v1/object/ad-ingest/${PREFIX}/ad-v${N}-${ANGLE}.png" \
     -H "Authorization: Bearer ${SUPABASE_SECRET_KEY}" \
     -H "Content-Type: image/png" --data-binary @"${ADS_DIR}/ad-v${N}-${ANGLE}.png"
   ```
   Grave `${ADS_DIR}/public-urls.txt`. Confirme cada URL com
   `curl -sS -o /dev/null -w "%{http_code} %{content_type}"` → deve ser `200 image/png`.

---

## 5. Passo 3 — Criar a campanha (PAUSED)

`ads_create_campaign` (conta `act_<ad_account_id>`):
- `name=[TRF][<SLUG-MAIUSC>][${DATE}] Tráfego CBO`, `objective=OUTCOME_TRAFFIC`,
  `buying_type=AUCTION`, `special_ad_categories=[]`, `status=PAUSED`.
- `daily_budget=<budget_cents_final>` (CBO), `bid_strategy=LOWEST_COST_WITHOUT_CAP`.

## 6. Passo 4 — Criar o ad set (PAUSED) — BR primeiro, fallback US só se bloqueado

`ads_create_ad_set` (parent = `meta_campaign_id`), **tente `BR` primeiro** (a agência é
brasileira — não assuma bloqueio de outro cliente):
- `targeting={"geo_locations":{"countries":["BR"]},"age_min":22,"age_max":65,
  "targeting_automation":{"advantage_audience":1}}` — sem `publisher_platforms`/
  `placement` (Advantage+ posicionamentos), sem interest IDs.
- `optimization_goal=LANDING_PAGE_VIEWS` (fallback `LINK_CLICKS` se a Meta recusar).
- Se a Meta recusar com subcode **`3858634`** ("Advertiser is missing" / verified
  advertiser) → **este cliente específico** tem o bloqueio documentado em
  [Runbook §18](../../../docs/how-to/operations-runbook.md#18-erro-meta-1003858634-verified-advertiser-missing). Recrie o ad set com `targeting.countries:["US"]` como
  placeholder, prefixe o nome com `[NEEDS-RETARGET-BR]`, e grave
  `needsRetarget:true` + instrução de retarget manual no manifest (§8). **Não** aplique
  esse fallback preventivamente a clientes que não bateram nesse erro.

## 7. Passo 5 — Criar os 3 ads (PAUSED) — imagem em `link_data.picture`

Para cada criativo, `ads_create_ad` (parent = `meta_ad_set_id`, `status=PAUSED`),
creative **inline** via `object_story_spec`. **A imagem vai DENTRO de `link_data`
como `picture` (URL pública). NUNCA `image_url` no topo** — o ad sai sem imagem:
```json
{"object_story_spec":{"page_id":"<facebook_page_id>","link_data":{
  "link":"<landing URL resolvida>",
  "picture":"https://.../public/ad-ingest/<slug>/${DATE}/.../ad-vN-<ângulo>.png",
  "message":"<primaryText>","name":"<headline>","description":"<description>",
  "call_to_action":{"type":"LEARN_MORE"}}}}
```
Capture `meta_ad_id` e `meta_creative_id` (via `ads_get_ad_entities`, level=ad,
fields incluindo `creative`).

## 8. Passo 6 — Validar

`ads_get_errors` para campanha, ad set e cada ad. Vazio → ok. Erro de imagem ausente
→ recriar com `picture` em `link_data`. Erro de geo/subcode `3858634` → aplicar
fallback US do Passo 4. `optimization_goal` inválido → cair para `LINK_CLICKS`.

## 9. Passo 7 — Persistir no Supabase (idempotente, upsert `ON CONFLICT`)

Mesmas tabelas/chaves de `create-traffic-cliente-exemplo-campaign` §Passo 7
(`clients` por `slug=<client>` → `client_id` já resolvido no Passo 0; `campaigns` por
`meta_campaign_id`; `ad_sets` por `meta_ad_set_id`; `generated_images` por
`(storage_bucket,storage_path)`; `creatives` por `meta_creative_id`; `ads` por
`meta_ad_id`; 1 `operation_logs` por entidade criada, `actor='claude-code'`).

## 10. Passo 8 — Manifest da run

`tentativas-geracao-de-campanhas/<slug>-${STAMP}-trafego.json`:
```json
{
  "skill": "create-traffic-campaign",
  "client": "<slug>",
  "date": "${DATE}",
  "verified": true,
  "campaign": {"meta_campaign_id":"...","name":"...","status":"PAUSED","daily_budget_cents":"<budget_cents_final>"},
  "ad_set": {"meta_ad_set_id":"...","optimization_goal":"...","geo":["BR"]},
  "ads": [{"meta_ad_id":"...","meta_creative_id":"...","angle":"autoridade","image_url":"...","status":"PAUSED"}],
  "creatives_source": "generated|reused",
  "refs_used": ["<paths ou [] se o cliente não tinha materiais>"],
  "needsRetarget": false,
  "errors": [],
  "decisions": ["geo=BR (default)", "cta=LEARN_MORE"],
  "ads_manager_url": "https://business.facebook.com/adsmanager/manage/campaigns?act=<ad_account_id>"
}
```
Se `rejected` (Passo 0), grave só `{"skill":..., "client":..., "rejected":true, "reason":"..."}`
e pare — sem chamar nenhuma tool de escrita do Meta. **Sempre** escreva o manifest.

## 11. Passo 9 — Resumo final (stdout)

Tabela markdown com IDs e status + link do Ads Manager + a frase: **"Tudo PAUSED —
custo Meta = 0. Ative manualmente no Ads Manager quando aprovar."** Se
`needsRetarget`, destaque a instrução de editar targeting US→BR antes de ativar.

---

## Critério de sucesso
- Cliente resolvido via `clients.slug` (nunca hardcoded).
- 3 PNGs + `public-urls.txt` (200 image/png) em `${ADS_DIR}` (dentro da pasta de
  materiais **daquele** cliente).
- 1 campanha + 1 ad set + 3 ads PAUSED na conta **daquele** cliente.
- Linhas no Supabase + `operation_logs`. Manifest gravado.

## Anti-padrões (NÃO faça)
- ❌ Hardcodar ad_account_id, budget, materials_path, ou qualquer dado de UM cliente específico nesta skill (ela é genérica — dados vêm de `clients`).
- ❌ Assumir bloqueio BR→US de outro cliente sem ver o erro `3858634` de verdade neste ad account.
- ❌ Exigir os 6 refs "canônicas" de um cliente específico — usar o que existir.
- ❌ `image_url` no topo do creative (ad sai sem imagem — use `link_data.picture`).
- ❌ Ativar qualquer entidade, ou ultrapassar `daily_budget_cap_cents` do cliente.
- ❌ Rodar os passos de criação enquanto a landing URL for placeholder.

## Pré-requisitos
- `.env.local` (local) ou `fly secrets` (prod) com `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
- MCP da Meta e MCP do Supabase autenticados.
- Bucket público `ad-ingest` no Supabase (existe — ADR 0003).
- Cliente cadastrado em `clients` (via dashboard ou `lista-de-clientes/SKILL.md`) com pelo menos `ad_account_id`, `facebook_page_id` e `default_landing_url` reais (não placeholder).
