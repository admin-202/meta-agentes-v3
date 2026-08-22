---
name: lista-de-clientes
description: lista que contem das informações de clientes como id da BM, conta de anúncios, página do instagram, URLs, limites de orçamentos diários por campanha etc.
allowed-tools: Read, Bash
---

## Clientes

### Viena Cacau (produto: Claude Code Architect — Meta Team Agents; infoprodutor: Bruno Bracaioli)

- Business Manager: `BM - Viena Cacau` — `912589663564936`
- Ad Account: `CA 01 - Viena Cacau` — `3836344939971458` (moeda BRL, orçamento mínimo diário 512 centavos)
- Facebook Page: `480545155136674` (Instagram vincula automático). Existe uma segunda page `101004586376914` associada à mesma ad account, nome não identificado — não usar até confirmar com o operador.
- URLs: **TODO — não confirmada.** O único valor conhecido é o placeholder `https://claude-code.cliente-site.io`, que não é um domínio real. **As skills operacionais desse cliente devem recusar-se a criar/editar campanhas de verdade enquanto esse campo não for preenchido com a URL real.**
- Payer/Advertiser (razão social pra `dsa_beneficiary`/`dsa_payor`): **TODO — não confirmado.** Placeholder anterior era `NOME-DO-PAGADOR`.
- Orçamento máximo permitido para esse cliente: R$ 50,00 por dia por campanha. (Nota: uma versão anterior deste arquivo dizia R$ 70,00; usei R$ 50,00 porque é o valor que as skills `create-traffic-viena-cacau-campaign` e `edicao-de-campanha-viena-cacau` já tinham como limite duro embutido — confirme com o operador se 70 era intencional.)
- Bloqueio ativo: Meta `100/3858634 verified advertiser missing` — criação de AdSet com targeting BR direto é rejeitada pela Marketing API. Workaround em uso: criar com `targeting.countries=["US"]` como placeholder e o operador troca manualmente pra BR no Ads Manager antes de ativar. Ver [runbook §18](../../../docs/how-to/operations-runbook.md#18-erro-meta-1003858634-verified-advertiser-missing) para o diagnóstico completo e como reverter quando a Meta aprovar o review.
- Materiais desse cliente estão em `.claude/materiais-das-empresas/Viena Cacau/`

### Dra Isitys (Clínica Elegance — Dra. Isitys Lorhanne Gomes Calçado)

- Nicho: estética facial, corporal e emagrecimento (Protocolo Curvas). Categoria de saúde/estética — regras de compliance estritas (ver abaixo).
- Business Manager: `Dra Isitys` — `26193780510235719`
- Ad Account: `Clinica Elegance` — `3127855317421725` (moeda BRL, orçamento mínimo diário 512 centavos, com forma de pagamento ativa)
- **Bloqueio ativo (2026-08-22)**: conta com `account_status=UNSETTLED` e não-queryable na Marketing API. Erro retornado pela Meta: "This ad account has a balance that needs to be paid before you can publish. Please verify your billing information is up to date." — **as skills operacionais desse cliente devem recusar-se a criar/ativar/editar campanhas reais enquanto essa fatura em aberto não for quitada pela cliente.** Revalidar o status antes de qualquer operação.
- Facebook Page: `308601112346926` ("Intensy"). **Atenção**: o BM tem duas páginas — "Intensy" (`308601112346926`, escolhida pelo operador em 2026-08-09) e "Clínica Intensy" (`330439036827456`, estava registrada antes e é a única já vinculada como "promoted page" da ad account). Nenhuma delas se chama "Isitys Lorhanne" nem "Clínica Elegance" — os materiais de planejamento no Drive citam uma página que não existe nesse BM; provável rebranding não documentado. Confirmar com a cliente antes de trocar de página de novo.
- URLs: `https://eleganceclinica.com/` (site) · Instagram `@clinicaelegance` · WhatsApp `(38) 99744-7551`.
- Orçamento máximo permitido: R$ 120,00/dia (`daily_budget_cap_cents=12000` na tabela `clients` do Supabase, definido antes desta sessão — tratado como teto agregado da conta, não por campanha).
- **Sem pixel/dataset configurado** nessa ad account (0 datasets) — ok para campanhas de mensagem/WhatsApp (não depende de pixel), mas bloqueia qualquer campanha de conversão em site até configurar Pixel + CAPI.
- 4 campanhas antigas na conta, todas já `PAUSED` — **não reativar sem revisão**: os nomes citam "MONJOURO" (provável referência ao medicamento Mounjaro), o que viola a regra Meta/CFM de não nomear medicamento no anúncio.
- **Compliance obrigatório** (saúde/estética, Meta 2025 + CFM Resolução 2.336/2023): nunca nomear medicamento; nunca prometer emagrecimento nem usar atributos pessoais ("Você está acima do peso?"); antes/depois só com caráter educativo e autorização do paciente, sem manipulação, mostrando resultados satisfatórios E insatisfatórios; nada de preço como isca em oferta de procedimento estético. Vender "protocolo com acompanhamento médico", nunca a medicação.
- Plano de estrutura completo (3 linhas de produto: A-Emagrecimento, B-Harmonização por cidade, C-Flacidez; nomenclatura `CE_[Linha]_[Objetivo]_[Cidade]_[AAAA-MM]`) e criativos modelados vêm do Google Drive da operadora (pasta "Dra Isitys- Claude"), não replicados aqui na íntegra — ver manifest em `.claude/materiais-das-empresas/manifests/dra-isitys-clinica-elegance-2026-08.json`.
- Materiais desse cliente estão em `.claude/materiais-das-empresas/Dra Isitys/` (pastas de logo/mascote/exemplo-de-ads ainda vazias — os criativos prontos, 43 imagens + copy, estão no Drive, não neste repo).

### Dr Jose (Escritório Aroso & Pontin — advocacia)

- Nicho: advocacia (direito bancário/consumidor — consignado, débitos automáticos, busca e apreensão de veículo, juros abusivos, endividamento PJ). Campanhas de mensagem (WhatsApp), objetivo `OUTCOME_LEADS`.
- Business Manager: `Escritorio Aroso & Pontin` — `708211482386212`
- Ad Account: `[GB] CA - Aroso & Pontin 2` — `1291059802753367` (moeda BRL, ACTIVE e queryable, com forma de pagamento ativa)
- Facebook Page: `708178332389527` ("Escritorio Aroso & Pontin")
- URLs/orçamento máximo: **TODO — não confirmado.** Não há registro de teto de orçamento diário nem de site/domínio pra esse cliente; só o manifest de campanha (abaixo). Confirmar com o operador antes de tratar como cliente totalmente ativo.
- **Sem pixel/dataset configurado** nessa ad account — bloqueia audiência de "site visitou" e campanhas de conversão em site (mensagem via WhatsApp não depende disso).
- 2 campanhas já criadas na conta, ambas `PAUSED`: `DRJOSE | MSG | PROSP | PF | AGO26` (4 ad sets: consignado, débito em conta, veículo, juros — R$20/dia cada) e `DRJOSE | MSG | PROSP | PJ | AGO26` (1 ad set: endividamento PJ — R$20/dia). Total planejado: R$100/dia se todos ativados.
- Criativos: usuário sobe os 5 vídeos e cria os anúncios manualmente direto no Ads Manager (não é fluxo automatizado pelas skills). Duas custom audiences de engajamento de página já existem (`PA | IG+FB ENGAJOU | 365D` reservada pra remarketing futuro; `PA | MSG INICIOU | 180D` já excluída dos 5 ad sets de prospecção).
- Manifest completo em `.claude/materiais-das-empresas/manifests/dr-jose-drjose-msg-prosp-ago26.json`.
- **Sem pasta de materiais dedicada** em `.claude/materiais-das-empresas/` (nem logo, nem exemplos de ads) — os vídeos e a copy vivem fora deste repo.

### ultronchat

- **Incompleto.** A pasta `.claude/materiais-das-empresas/ultronchat/` existe mas está vazia (sem logo, sem exemplos de ads, sem materiais). Nenhum dado de BM/Ad Account/Page foi levantado ainda. Não criar skills operacionais para este cliente até os materiais e os IDs Meta serem coletados.
