# Roadmap de IA — Actual (fork)

Plano de entregas das funcionalidades de IA. A arquitetura detalhada (decisões,
topologia, módulos) está em [ARCHITECTURE.md](./ARCHITECTURE.md).

**Visão**: classificação de transações híbrida (regras + LLM) que fica mais
barata e mais precisa com o tempo, e — mais adiante — um consultor financeiro
conversacional. Tudo LLM-agnóstico, local-first e com custo controlado.

## Fase 0 — Fundação da harness

A infraestrutura mínima para qualquer agente rodar. Nenhuma funcionalidade de
usuário ainda, exceto a tela de configuração.

Entregáveis:

- [ ] Pacote `packages/ai-core` (`@actual-app/ai`): registry de
      providers/modelos/tiers sobre o Vercel AI SDK, definição declarativa de
      agentes, `runWorkflow`, contabilidade de custo, blocos de prompt com
      cache, redação de PII.
- [ ] `app-ai` no sync-server: proxy autenticado com allowlist + injeção de
      chave; novos `SecretName` no secrets service (per-budget, padrão Pluggy).
- [ ] Migração `ai_runs` + lockstep (db/types, models, AQL schema).
- [ ] UI de settings: escolha de provider por tier, entrada de chaves (salvas
      no servidor), host do Ollama, toggle de redação de PII.
- [ ] Telemetria mínima: tokens/custo acumulado visível na tela de settings.

Critério de saída: um comando dev (`ai/classify-pending` chamado à mão numa
transação) percorre cliente → proxy → provider → resposta estruturada → registro
em `ai_runs`, com pelo menos dois providers testados (um cloud + Ollama).

## Fase 1 — Triagem pós-sync (MVP) ← primeira entrega

Classificação em lote dos não-categorizados a cada bank sync.

Entregáveis:

- [ ] Agente `classifier` (workflow, tier standard): lote de até ~50
      transações, contexto com árvore de categorias + histórico de payee +
      few-shot de correções, saída estruturada `{id, category, confidence,
rationale}`.
- [ ] Migração `ai_suggestions` + lockstep.
- [ ] Hook pós-sync em `accounts/sync.ts` (mesmo ponto do `syncPluggyBills`).
- [ ] Cache local de respostas (payee normalizado + faixa de valor + conta).
- [ ] Política de confiança: alta → aplica com marcação de origem IA;
      média → pendência; baixa → nada.
- [ ] Inbox de revisão na UI: lista de pendências, aceitar / corrigir /
      rejeitar; marcação visual no register para `auto_applied`.
- [ ] Correções alimentam o golden set de evals (base do feedback loop).

Critério de saída: um sync Pluggy real classifica o lote do dia com custo
registrado e as pendências aparecem no inbox.

## Fase 2 — Mineração de regras

O agente varre o histórico e propõe regras seguras, com justificativa
auditável.

Entregáveis:

- [ ] Agente `rule-miner` (workflow): agrupa transações por payee/descrição,
      propõe regras (`matches`/`contains`/`oneOf` — operadores já existentes
      no motor de regras) apenas quando o padrão é consistente no histórico.
- [ ] Migração `ai_rule_meta` (rationale, amostras, estatísticas de precisão) + lockstep.
- [ ] UI de aprovação em lote: regras nascem como proposta, nunca ativas
      direto; usuário revisa com o rationale e as transações-amostra ao lado.
- [ ] Feedback loop: correções do usuário (Fase 1) entram na fila do minerador
      para propor regra nova ou ajuste de regra existente.

Critério de saída: rodada de mineração no histórico real propõe regras que,
aprovadas, reduzem mensuravelmente o volume que chega ao classificador
(comparar `ai_runs` antes/depois).

## Fase 3 — Auditor por amostragem

Fecha o trio regras → auditoria → especialista com custo sob controle.

Entregáveis:

- [ ] Agente `auditor` (workflow, tier fast): valida hits de regra por
      amostragem — 100% em regra nova, decaindo até 2–5% conforme a precisão
      observada em `ai_rule_meta` sobe; correção do usuário reseta a taxa.
- [ ] Hit reprovado pelo auditor cai no classificador (Fase 1) e gera
      pendência.
- [ ] Painel de saúde das regras: precisão observada, últimos falsos
      positivos, regra candidata a revisão.
- [ ] Evals rodando em CI local (vitest) contra o golden set.

Critério de saída: taxa de auditoria média das regras maduras < 10% dos hits,
sem queda de precisão no golden set.

## Fase 4 — Wizard de categorias (onboarding)

Primeiro uso da infra conversacional; é também o ensaio para o consultor.

Entregáveis:

- [ ] `runAgentLoop` no ai-core: loop de tool-use com orçamento de passos,
      streaming para a UI.
- [ ] Agente `category-designer` (loop, tier frontier): observa as transações
      das contas conectadas, propõe uma estrutura de categorias, itera com o
      usuário até a lista final e aplica (tool `write` com confirmação).
- [ ] UI de conversa reutilizável (será a base do chat do consultor).

Critério de saída: num orçamento novo com contas Pluggy conectadas, o wizard
chega a uma lista de categorias aceita pelo usuário e a cria de fato.

## Fase 5 — Consultor financeiro

Agente conversacional com acesso amplo aos dados. Escopo a refinar quando a
Fase 4 estiver de pé; o que já está decidido:

- Nasce **read-only**: tools de consulta (transações, orçamento, relatórios,
  faturas de cartão) via AQL; qualquer tool `write` exige confirmação
  explícita na UI, sempre.
- Tier frontier, streaming, memória de conversa persistida localmente.
- Reusa integralmente: tool registry, runner de loop, UI de conversa (Fase 4),
  telemetria e limites de custo (Fase 0).

## Riscos e mitigação

| Risco                                         | Mitigação                                                                                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custo descontrolado em históricos grandes     | Limites por run/dia (Fase 0) antes de qualquer agente; lote + cache; mineração processa em janelas                                                                     |
| Classificação errada aplicada automaticamente | Limiar de confiança configurável, marcação visual de origem IA, reversível em 1 clique no inbox                                                                        |
| Regressão silenciosa ao trocar modelo/prompt  | Golden set de evals a partir das correções reais (Fase 1+)                                                                                                             |
| Payload de PII para nuvem                     | Redação por padrão + modo somente-Ollama                                                                                                                               |
| Divergência com upstream                      | Código novo em `packages/ai-core` e módulos novos (`server/ai/`, `app-ai`); arquivos compartilhados recebem só deltas aditivos — mesmo contrato do trabalho de cartões |
