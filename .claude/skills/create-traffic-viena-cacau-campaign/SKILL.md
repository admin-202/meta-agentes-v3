---
name: create-traffic-viena-cacau-campaign
description: Cria campanha de tráfego completa (campaign + adset + 3 ads) para o cliente Viena Cacau (produto Claude Code Architect), headless-safe. Tudo PAUSED — nada vai ao ar sem ativação manual.
allowed-tools: Bash, Read, Grep, Glob, Write
---

# Skill: criar campanha de tráfego — Viena Cacau

## CONTRATO HEADLESS — leia antes de qualquer ação

Esta skill é projetada para rodar em modo `claude -p` (não-interativo). Portanto:

- **NUNCA** chame `AskUserQuestion`. Sem confirmações. Sem perguntas. Decida com os defaults documentados abaixo.
- **NUNCA** ative campanhas, adsets ou ads. Tudo termina em `PAUSED`. Ativação é exclusivamente manual no Ads Manager.
- **NUNCA** ultrapasse R$ 50,00/dia por campanha (limite duro do cliente).
- **NUNCA** invente IDs de interesse. Use exclusivamente Advantage+ audience expansion (broad targeting).
- **SEMPRE** termine escrevendo o manifest JSON (item 7 do fluxo). Se falhou no meio, escreva o manifest com `error` e o que conseguiu criar — sem manifest a sessão é considerada falha.

## PRÉ-CONDIÇÃO BLOQUEANTE — verifique antes do passo 1

A URL real da landing page e a razão social do payer/advertiser (`dsa_beneficiary`/`dsa_payor`) ainda **não foram confirmadas** (ver `.claude/skills/lista-de-clientes/SKILL.md`). Enquanto `URL da landing` abaixo continuar sendo o placeholder `https://claude-code.cliente-site.io`:

- **NÃO** chame nenhuma tool de escrita do Meta Ads MCP (`ads_create_campaign`, `ads_create_ad_set`, `ads_create_ad`).
- Escreva direto o manifest do passo 7 com `"rejected": true`, `"reason": "landing URL e/ou payer legal name não confirmados em lista-de-clientes"` e pare.

Quando o operador atualizar `lista-de-clientes/SKILL.md` com os valores reais, atualize os defaults abaixo também e remova este bloco.

## Inputs (defaults — não pergunte)

| Campo | Valor |
|---|---|
| URL da landing | `https://claude-code.cliente-site.io` **(placeholder — ver pré-condição acima)** |
| Ad Account ID | `3836344939971458` |
| Business Manager ID | `912589663564936` |
| Facebook Page | `480545155136674` (Instagram vincula automático) |
| Materiais | `.claude/materiais-das-empresas/Viena Cacau/` |
| Limite de orçamento | R$ 50,00/dia |

## Defaults da campanha (sem confirmação)

| Camada | Valor |
|---|---|
| Objetivo | `OUTCOME_TRAFFIC` |
| Optimization goal | `LANDING_PAGE_VIEWS` |
| Billing event | `IMPRESSIONS` |
| Bid strategy | `LOWEST_COST_WITHOUT_CAP` (CBO default) |
| Daily budget | `5000` (centavos = R$ 50,00) |
| Buying type | `AUCTION` |
| Special ad categories | `[]` |
| País | Brasil |
| Idade | 22-65 |
| Audience | Advantage+ broad (sem interest IDs) |
| Destination | `WEBSITE` |
| Status (todas camadas) | `PAUSED` |

## Naming convention (determinístico — para idempotência e rastreio)

Seja `YYYY-MM-DD` a data ISO de hoje.

- **Pasta de creativos**: `.claude/materiais-das-empresas/Viena Cacau/generated-ads/cca-YYYY-MM-DD/`
- **Arquivos de imagem**: `ad-v1-autoridade.png`, `ad-v2-dor.png`, `ad-v3-oferta.png`
- **Pasta remota Supabase**: `viena-cacau/cca-YYYY-MM-DD-<unix-ts>/`
- **Campanha**: `[TRF][CCA][YYYY-MM-DD] Claude Code Architect — Traffic CBO`
- **AdSet**: `[ADSET][CCA][YYYY-MM-DD] Devs BR 22-65 — Advantage+ LPV`
- **Ads**:
  - `[AD][CCA][YYYY-MM-DD] v1 Autoridade — LEARN_MORE`
  - `[AD][CCA][YYYY-MM-DD] v2 Dor — LEARN_MORE`
  - `[AD][CCA][YYYY-MM-DD] v3 Oferta — SIGN_UP`

## Variantes de criativo (3 ads)

| # | Tema | CTA Meta |
|---|---|---|
| v1 | Autoridade (apresentação do produtor + prova) | `LEARN_MORE` |
| v2 | Dor (problema do público — vibe coding não escala) | `LEARN_MORE` |
| v3 | Oferta (bônus, garantia, próximo passo) | `SIGN_UP` |

## Fluxo (ordem obrigatória)

### 0. Checagem da pré-condição
Leia `.claude/skills/lista-de-clientes/SKILL.md`. Se o campo URLs da Viena Cacau ainda contiver "TODO" ou o placeholder `claude-code.cliente-site.io`, pule direto pro passo 7 com `rejected: true` (ver bloco "PRÉ-CONDIÇÃO BLOQUEANTE" acima).

### 1. Scrape da landing
Delegue ao subagent `scrape-extractor` com a URL. Recebe brief estruturado (theme, value proposition, CTA, tom).

### 2. Geração paralela de prompts + copy
Em paralelo (uma única mensagem com 2 Agent calls):
- `image-prompt-generator` — recebe o brief + paths das referências visuais em `.claude/materiais-das-empresas/Viena Cacau/` (logo, foto do produtor, exemplo de ad). Retorna 3 prompts (autoridade, dor, oferta) para 1:1 feed.
- `copywriter` — recebe o brief. Retorna 3 sets de copy: headline (≤40), primaryText (≤250), description (≤30), callToActionType por variante.

### 3. Geração das 3 imagens
Crie a pasta `generated-ads/cca-YYYY-MM-DD/`. Use a skill `image-generate` para gerar as 3 PNGs em paralelo (3 Bash backgrounds). Aguarde com `until` polling até as 3 existirem e `size > 0`. NÃO use `sleep` cego.

### 4. Upload Supabase Storage (secret key, não anon)
Faça `set -a; eval "$(tr -d '\r' < /mnt/c/Projects/agents_team_meta_ads_v3_template/.env.local)"; set +a` para carregar as vars. Use `SUPABASE_SECRET_KEY` (bypassa RLS — não depende de policy). Upload pra bucket público `generated-images`, caminho `viena-cacau/cca-YYYY-MM-DD-$(date +%s)/<arquivo>.png`. Capture as 3 URLs públicas (`${SUPABASE_URL}/storage/v1/object/public/generated-images/<caminho>`).

### 5. Criação Meta Ads (4 chamadas MCP, na ordem)

5.1 `ads_create_campaign`:
- `ad_account_id`: `3836344939971458`
- `campaign_name`: `[TRF][CCA][YYYY-MM-DD] Claude Code Architect — Traffic CBO`
- `objective`: `OUTCOME_TRAFFIC`
- `buying_type`: `AUCTION`
- `campaign_daily_budget`: `5000`
- `special_ad_categories`: `[]`
- (status default = PAUSED)

5.2 `ads_create_ad_set`:
- `ad_account_id`: `3836344939971458`
- `campaign_id`: (id retornado em 5.1)
- `name`: `[ADSET][NEEDS-RETARGET-BR][CCA][YYYY-MM-DD] Devs 22-65 — Advantage+ LPV (US placeholder)`
- `optimization_goal`: `LANDING_PAGE_VIEWS`
- `billing_event`: `IMPRESSIONS`
- `destination_type`: `WEBSITE`
- `targeting`: `{"geo_locations":{"countries":["US"]},"age_min":22,"age_max":65,"targeting_automation":{"advantage_audience":1}}`
- `dsa_beneficiary`: valor de "Payer/Advertiser" em `lista-de-clientes/SKILL.md` (hoje ainda `NOME-DO-PAGADOR`, placeholder — ver pré-condição)
- `dsa_payor`: idem
- Status PAUSED

> **WORKAROUND ATIVO** (confirmado ainda em vigor pelo operador em 2026-07-27 — ver [Runbook §18](../../../docs/how-to/operations-runbook.md#18-erro-meta-1003858634-verified-advertiser-missing) pro contexto completo): o targeting está em `US` como placeholder porque a Meta bloqueia criação de AdSet BR via Marketing API enquanto o advertiser/payer não está habilitado pra BR no backend (form de review pendente). Os campos `dsa_beneficiary`/`dsa_payor` ficam no payload mesmo com país `US`.
>
> **Antes de ATIVAR a campanha** no Ads Manager o operador DEVE:
> 1. Editar o AdSet → mudar `Targeting → Countries` de `US` para `Brasil` (BR)
> 2. A UI da Meta vai forçar selecionar advertiser/payer no momento da edição — escolhe a razão social da Viena Cacau no dropdown
> 3. Salvar a edição
> 4. Conferir nome do AdSet e remover o prefixo `[NEEDS-RETARGET-BR]` se quiser
> 5. Só então ativar (Campaign → AdSet → Ads)
>
> **Quando o form de review for aprovado** (cliente reverificar advertiser/payer pra BR no backend), reverter este Step 5.2: mudar `"US"` → `"BR"` no targeting, e remover `[NEEDS-RETARGET-BR]` do nome do AdSet. Atualize também a nota em `lista-de-clientes/SKILL.md`.

5.3 `ads_create_ad` x3 (uma por variante):
- `ad_account_id`: `3836344939971458`
- `adset_id`: (id retornado em 5.2)
- `name`: conforme naming convention acima
- `creative_link_url`: URL real da landing (ver pré-condição — não use o placeholder)
- `creative_image_url`: URL do Supabase pra essa variante
- `creative_page_id`: `480545155136674`
- `creative_message`: primaryText do copywriter
- `creative_link_title`: headline do copywriter
- `creative_link_description`: description do copywriter
- `creative_call_to_action_type`: conforme tabela de variantes (LEARN_MORE x2, SIGN_UP x1)
- Status PAUSED

### 6. Validação (read-only)
Chame `ads_get_ad_entities` com filtro `campaign.id = <id>` em level `ad`. Confirme que retornou 3 ads em status PAUSED. Se não, marque o manifest com `verified: false` e razão.

### 7. Manifest JSON (output obrigatório — SEM ISSO O RUN É FALHA)

Escreva em `tentativas-geracao-de-campanhas/YYYYMMDD-HHMM-trafego.json`:

```json
{
  "skill": "create-traffic-viena-cacau-campaign",
  "client": "viena-cacau",
  "createdAt": "2026-07-27T18:05:00-03:00",
  "adAccountId": "3836344939971458",
  "campaignId": "120245...",
  "adSetId": "120245...",
  "ads": [
    { "id": "120245...", "variant": "autoridade", "cta": "LEARN_MORE", "imageUrl": "https://yxfjtrdupwfaljrxrveq.supabase.co/storage/v1/object/public/generated-images/viena-cacau/cca-2026-07-27-.../ad-v1-autoridade.png", "localPath": ".claude/materiais-das-empresas/Viena Cacau/generated-ads/cca-2026-07-27/ad-v1-autoridade.png" },
    { "id": "120245...", "variant": "dor", "cta": "LEARN_MORE", "imageUrl": "...", "localPath": "..." },
    { "id": "120245...", "variant": "oferta", "cta": "SIGN_UP", "imageUrl": "...", "localPath": "..." }
  ],
  "budgetDailyCents": 5000,
  "status": "PAUSED",
  "verified": true,
  "needsRetarget": true,
  "retargetInstructions": "AdSet criado com targeting=US como placeholder (workaround do bloqueio Meta 100/3858634 — ver Runbook §18). Antes de ativar: edite targeting US→BR no Ads Manager UI, escolha a razão social da Viena Cacau no prompt advertiser/payer que vai aparecer, salve, então ative.",
  "adsManagerUrl": "https://business.facebook.com/adsmanager/manage/campaigns/edit?act=3836344939971458&selected_campaign_ids=120245...",
  "errors": []
}
```

Quando o bloqueio `100/3858634` for resolvido (form de review aprovado) e o Step 5.2 voltar pra targeting BR direto, omitir `needsRetarget` e `retargetInstructions` do manifest.

Se houve falha parcial: preencha o que conseguiu, adicione `"errors": [{ "step": "5.3-ad-v2", "message": "..." }]` e `"verified": false`. Não tente "limpar" entidades parciais — campanha PAUSED não custa nada e é mais útil debugar no Ads Manager do que apagar evidência.

### 8. Output final
Imprima uma tabela markdown enxuta com IDs e status. **Inclua uma linha de aviso destacada lembrando o operador de editar targeting US→BR antes de ativar** (enquanto `needsRetarget` for true). Sem perguntas, sem sugestões de "ativar agora?".

## NUNCA faça

- ❌ Chamar `AskUserQuestion` (quebra `-p`)
- ❌ Chamar `ads_activate_entity` (ativação só manual)
- ❌ Ultrapassar `campaign_daily_budget: 5000`
- ❌ Inventar `interests` ou `behaviors` IDs no targeting
- ❌ Usar anon key + RLS policy pro upload — use sempre `SUPABASE_SECRET_KEY`
- ❌ Rodar os passos 1-6 enquanto a landing URL/payer legal name ainda forem placeholder (ver pré-condição)
- ❌ Dormir cego com `sleep 90`. Use `until [[ -s file ]]; do sleep 2; done`
- ❌ Continuar sem escrever o manifest do passo 7
