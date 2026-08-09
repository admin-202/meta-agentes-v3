# ADR 0013 — Design system das landing pages (claro + blocos escuros, síntese de duas referências)

| Campo | Valor |
|---|---|
| Status | Accepted |
| Data | 2026-06-02 |
| Decidido por | Equipe |
| Spec | [docs/specs/SPEC-011-landing-page-generation.md](../specs/SPEC-011-landing-page-generation.md) |
| Relacionado | [ADR 0012](0012-landing-pages-on-cloudflare-pages.md) (hosting/deploy das LPs) |
| Afeta | `landing-pages/_template/` (CSS, layout, seções), `.claude/agents/landing-page-architect.md`, `.claude/agents/lp-copywriter.md` |

## Context

O template canônico de LP (ADR 0012) funcionava mas tinha estilo **plano**: navy 100%
escuro + laranja, fontes de sistema, CSS vanilla, 10 seções, quase sem movimento. Faltava
uma linguagem visual definida e uma arquitetura de persuasão à altura de páginas de vendas
BR profissionais.

O usuário pediu para definir o estilo como um **meio-termo / versão melhor** entre duas
referências reais:

- **deployclub.com** — polish moderno de SaaS: tipografia Inter + DM Sans, CTAs pill com
  *pulse*, marquees de prova social, glassmorphism, *fade-in on scroll*, grids 3-col,
  sombras suaves, container 1200px.
- **claude.escoladeautomacao.com.br/operacao-claude-code** — arquitetura de persuasão de
  página de vendas BR: barra de urgência/escassez, tabela comparativa, *proof storm*
  (depoimentos + logos de mídia + stats), currículo em pilares, segmentação por persona,
  ancoragem de preço, bloco de autoridade, garantia, selos de pagamento; base clara com
  blocos escuros alternados.

A marca já estabelecida é navy + laranja ("tech"). A síntese precisa pegar o **polish
visual** do deployclub + a **arquitetura de persuasão** da escola, sem perder a marca.

## Decision

Adotar um **design system claro com blocos escuros**, sintetizando as duas referências:

1. **Tema base claro + blocos escuros.** Base branca/cinza-clara (`#FFFFFF`/`#F7F9FC`);
   `hero`, `urgency`, `stats`, `authority`, `offer`, `finalCta`, `footer` são blocos navy
   escuros para drama; demais seções de leitura alternam striping claro/off-white. (Escolha
   do usuário sobre "dark-only" e "light-only".)
2. **Laranja `#FF6B1A` continua o accent primário** (marca). Adicionadas cores funcionais:
   verde `#16A34A` (✓), vermelho `#DC2626` (✗/urgência), âmbar `#F59E0B` (estrelas) — padrão
   funcional comum às duas refs.
3. **Tipografia Inter (títulos) + DM Sans (corpo)** via **`@fontsource`** (npm self-hosted),
   **não** `next/font/google`, para não depender de rede no `next build` headless do runner
   Fly.
4. **Movimento elegante e leve:** `fade-in on scroll` (IntersectionObserver), marquee CSS de
   prova social, *pulse* no CTA primário, *hover-lift* nos cards. Sem libs de animação; tudo
   degrada sob `@media (prefers-reduced-motion: reduce)`.
5. **Taxonomia de seções expandida** (architect escolhe quais usar por página). Novas:
   `urgency` (countdown de deadline FIXO + escassez), `comparison` (tabela ✓/✗),
   `stats` (faixa de números), `logos` ("como visto em"), `persona` ("pra quem é"),
   `authority` (bio + glass panel), `guarantee` (risk-reversal dedicado). O `proof` virou
   marquee. Tom visual é **fixo por tipo de seção** no template — o architect só ordena.

Tudo continua **static export** (`output:'export'`): zero features de servidor; o countdown
de urgência é client-side contra um deadline ISO fixo em `content-spec.deadline` (se ausente
ou passado, o timer some — nunca quebra o build). Tracking/consent LGPD permanece intacto:
pixel/GA4 só pós-consent em `Tracking.tsx`, nunca no HTML inicial.

## Consequences

**Positivas**
- LPs com cara de página de vendas BR profissional de alta conversão, sem mudar o contrato
  de deploy/skill/Nexus/migrations/secrets.
- Estilo determinístico e auditável: o gerador escolhe seções e copy; cores/tom são fixos.
- Fontes self-hosted → build headless reprodutível e offline-safe no Fly.
- Acessibilidade: `prefers-reduced-motion` respeitado; contraste AA mantido.

**Negativas / trade-offs**
- Mais seções e CSS para manter; mais campos no shape de `messages`/`content-spec` e nos
  dois subagents.
- `+~3KB` de JS (FadeIn/Countdown client) e `~54` arquivos de fonte no `out/` (subset latin,
  poucos pesos) — peso ainda leve, monitorar.
- `content-spec.deadline` é uma data fixa: precisa ser atualizada por campanha (degradação
  graciosa quando expira evita bug, mas o timer simplesmente some).

## Alternatives rejected

- **Dark-only (estado atual).** Distinto e on-brand, mas plano e menos familiar para o
  público BR de infoproduto; descartado pela escolha do usuário.
- **Light-only sem blocos escuros.** Mais próximo do deployclub puro, mas perde o drama dos
  blocos navy e a identidade da marca.
- **`next/font/google`.** Mais idiomático, mas adiciona dependência de rede no `next build`
  do runner headless — risco de falha de build offline. Preterido por `@fontsource`.
- **Lib de animação (Framer Motion etc.).** Excesso para o efeito desejado; pesa o bundle de
  um export estático. Preterido por IntersectionObserver + CSS keyframes.
