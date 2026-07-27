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

### ultronchat

- **Incompleto.** A pasta `.claude/materiais-das-empresas/ultronchat/` existe mas está vazia (sem logo, sem exemplos de ads, sem materiais). Nenhum dado de BM/Ad Account/Page foi levantado ainda. Não criar skills operacionais para este cliente até os materiais e os IDs Meta serem coletados.
