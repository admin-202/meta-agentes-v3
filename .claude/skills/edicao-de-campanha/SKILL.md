---
name: edicao-de-campanha
description: Edita campanhas/adsets/ads (orçamento, status, targeting, creative) de QUALQUER cliente cadastrado na tabela `clients` do Supabase — headless-safe, opera via Meta Ads MCP sem perguntas, dentro dos limites duros do cliente DONO da entidade (resolvido automaticamente pelo ID Meta). Use quando pedirem para editar/pausar/ativar/ajustar orçamento de uma campanha, adset ou ad, informando o ID Meta (e opcionalmente `client=<slug>` se o ID ainda não estiver persistido no Supabase).
argument-hint: "id=<meta-id> change=<budget|status|name|targeting> value=<novo-valor> [client=<slug>] [force=true]"
allowed-tools: Read, Glob, Grep, Bash, Write, mcp__claude_ai_Meta_Ads_MCP__ads_get_ad_entities, mcp__claude_ai_Meta_Ads_MCP__ads_update_entity, mcp__claude_ai_Meta_Ads_MCP__ads_activate_entity, mcp__claude_ai_Meta_Ads_MCP__ads_create_ad, mcp__supabase__execute_sql
---

# Skill: editar campanhas — genérica, multi-cliente

Versão **generalizada** de `edicao-de-campanha-viena-cacau`: em vez de limites e
ad_account_id hardcoded de UM cliente, esta skill **resolve o cliente dono da
entidade automaticamente** (via as tabelas `campaigns`/`ad_sets`/`ads` no Supabase,
que guardam `client_id`) e aplica os limites daquele cliente específico
(`clients.daily_budget_cap_cents`). Funciona para qualquer cliente cadastrado, sem
editar código.

## CONTRATO HEADLESS

- **NUNCA** chame `AskUserQuestion`. Receba o pedido via prompt/args e execute.
- **NUNCA** exceda os limites duros do cliente **dono da entidade** (ver §2).
- **NUNCA** ative entidade sem pedido explícito (`"ativar"`, `"activate"`, `"resume"`, `"ON"`).
- **SEMPRE** escreva o manifest do passo final, mesmo em falha/rejeição.

## 1. Parse do pedido

Identifique: `target` (campaign|adset|ad), `id` (ID Meta, 15-20 dígitos — resolva por
nome via `ads_get_ad_entities` com filtro `name CONTAINS` se só veio o nome),
`change` (budget|status|name|targeting), `value` (novo valor), `force` (bool,
opcional), `client` (slug, opcional — só necessário se o ID ainda não está
persistido no nosso Supabase).

## 2. Resolver o cliente dono da entidade (SEMPRE, antes de validar limites)

Consulte a tabela correspondente ao `target` pelo ID Meta, join em `clients`:
```sql
-- exemplo pra target=campaign
select c.id as client_id, c.slug, c.name, c.ad_account_id, c.daily_budget_cap_cents,
       camp.daily_budget_cents as current_budget_cents, camp.status
from campaigns camp
join clients c on c.id = camp.client_id
where camp.meta_campaign_id = '<id>';
-- adapte para ad_sets.meta_ad_set_id / ads.meta_ad_id conforme o target
```
- **Encontrado** → use `daily_budget_cap_cents` e `ad_account_id` **deste** cliente
  para todas as validações abaixo. Nunca reuse o cap de outro cliente.
- **Não encontrado** e veio `client=<slug>` no argumento → busque o cap em `clients`
  por esse slug e prossiga (a entidade provavelmente foi criada fora desta run, ex.
  manualmente no Ads Manager). Ao persistir no passo 7, faça upsert também da
  entidade que faltava.
- **Não encontrado** e **sem** `client=` → **não é seguro validar o limite de
  orçamento sem saber de quem é a conta.** Manifest `rejected:true`,
  `reason:"ID não encontrado no Supabase — informe client=<slug> para validar o limite de orçamento com segurança"`, pare. **Nunca** edite às cegas sem um cap conhecido.

## 3. Limites duros (validação ANTES de chamar MCP — usam os valores do cliente resolvido em §2)

| Regra | Valor |
|---|---|
| Aumento de orçamento por edição | Máximo +30% do valor atual da entidade |
| Cap absoluto de daily budget | `clients.daily_budget_cap_cents` **do cliente dono** |
| Frequência mínima entre edições da mesma campanha | 24h |

Exemplo: cliente com cap R$50/dia, campanha atual em R$30/dia → aumento permitido
até R$39/dia. Campanha em R$45/dia → até R$50 (cap, não R$58,50). Em R$50 → não
pode aumentar. Se o pedido violar, **não chame o MCP** — manifest `rejected:true`
com `reason` e termine. Não negocie, apenas reporte.

## 4. Operações suportadas

| Operação | Tool MCP |
|---|---|
| Ler estado atual | `ads_get_ad_entities` |
| Alterar orçamento, nome, targeting | `ads_update_entity` |
| Ativar (PAUSED → ACTIVE) | `ads_activate_entity` |
| Pausar (ACTIVE → PAUSED) | `ads_update_entity` com `status=PAUSED` |
| Adicionar criativo novo a adset existente | `ads_create_ad` (não `update`) |

## 5. Fluxo

### 5.1 Estado atual
`ads_get_ad_entities` no `target`/`id` — capture `daily_budget`, `status`, `name`,
`targeting`. **Confira que o `account_id` retornado bate com o `ad_account_id` do
cliente resolvido em §2** — se não bater, pare e rejeite (sinal de ID errado ou
cliente resolvido errado).

### 5.2 Validação dos limites
Aplique §3. Se violar, pule pro passo 5.5 com `rejected:true`.

### 5.3 Histórico recente
Leia `tentativas-geracao-de-campanhas/*-edicao.json` ordenado por data, filtrando
pelo mesmo `id`. Se editada nas últimas 24h, recuse — a menos que `force:true` no
argumento.

### 5.4 Execução
`ads_update_entity` ou `ads_activate_entity` com os campos calculados. Agrupe
múltiplas mudanças numa única chamada quando possível.

### 5.5 Verificação
Releia via `ads_get_ad_entities`, confirme que o estado pós-edição bate com o
esperado.

### 5.6 Persistir no Supabase
Upsert na tabela do `target` (`campaigns`/`ad_sets`/`ads`, conflict no ID Meta) com
os campos alterados, e 1 `operation_logs` (`entity_type`, `entity_id`,
`meta_entity_id`, `action='update'` ou `'activate'`/`'pause'`, `actor='claude-code'`,
`summary` humano).

### 5.7 Manifest
`tentativas-geracao-de-campanhas/<slug>-${STAMP}-edicao.json`:
```json
{
  "skill": "edicao-de-campanha",
  "client": "<slug resolvido em §2>",
  "editedAt": "...",
  "target": { "level": "campaign", "id": "120245...", "name": "..." },
  "change": { "field": "daily_budget", "from": 3000, "to": 3900 },
  "rejected": false,
  "reason": null,
  "verified": true,
  "errors": []
}
```
Em falha/rejeição: `rejected:true`, `reason` descritivo, sem chamada ao MCP.

### 5.8 Output
Tabela markdown enxuta: `cliente → target → change → resultado`. Sem perguntas.

## NUNCA

- ❌ Validar limites sem antes resolver o cliente dono da entidade (§2).
- ❌ Reusar o cap/ad_account_id de outro cliente.
- ❌ Aumentar orçamento mais que 30% ou acima do cap do cliente resolvido.
- ❌ Ativar entidade sem pedido explícito.
- ❌ Editar a mesma entidade duas vezes em 24h sem `force`.
- ❌ Chamar `AskUserQuestion`.
- ❌ Continuar sem escrever o manifest.
