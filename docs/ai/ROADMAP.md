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

- [x] Pacote `packages/ai-core` (`@actual-app/ai`): registry de
      providers/modelos/tiers sobre o Vercel AI SDK, definição declarativa de
      agentes, `runWorkflow`, contabilidade de custo, blocos de prompt com
      cache, redação de PII.
- [x] `app-ai` no sync-server: proxy autenticado com allowlist + injeção de
      chave; novos `SecretName` no secrets service (per-budget, padrão Pluggy).
- [x] Migração `ai_runs` + lockstep (db/types, models, AQL schema).
- [x] UI de settings: escolha de provider por tier, entrada de chaves (salvas
      no servidor), host do Ollama, toggle de redação de PII.
- [x] Telemetria mínima: tokens/custo acumulado visível na tela de settings.

Critério de saída: um comando dev (`ai/classify-pending` chamado à mão numa
transação) percorre cliente → proxy → provider → resposta estruturada → registro
em `ai_runs`, com pelo menos dois providers testados (um cloud + Ollama).
O fluxo cloud foi coberto pelo sync real da Fase 1; o smoke test com Ollama
continua como validação operacional.

## Fase 1 — Triagem pós-sync (MVP) ← primeira entrega

Classificação em lote dos não-categorizados a cada bank sync.

Entregáveis:

- [x] Agente `classifier` (workflow, tier standard): lote de até ~50
      transações, contexto com árvore de categorias + histórico de payee +
      few-shot de correções, saída estruturada `{id, category, confidence,
rationale}`.
- [x] Migração `ai_suggestions` + lockstep.
- [x] Hook pós-sync em `accounts/sync.ts` (mesmo ponto do `syncPluggyBills`).
- [x] Cache persistente de decisões confirmadas (payee normalizado + faixa de
      valor + conta), com consenso mínimo e evidência negativa de rejeições.
- [x] Política de confiança: alta → aplica com marcação de origem IA;
      média → pendência; baixa → nada.
- [x] Inbox de revisão na UI: lista de pendências, aceitar / corrigir /
      rejeitar; marcação visual no register para `auto_applied`.
- [x] Aceites, correções, rejeições e classificações manuais alimentam
      `ai_feedback`, os few-shots e o golden set de evals.

Critério de saída: um sync Pluggy real classifica o lote do dia com custo
registrado e as pendências aparecem no inbox. **Validado manualmente em
24/07/2026.**

## Fase 2 — Mineração de regras

O agente varre o histórico e propõe regras seguras, com justificativa
auditável.

Entregáveis:

- [x] Agente `rule-miner` (workflow): agrupa transações por payee/descrição,
      propõe regras (`matches`/`contains`/`oneOf` — operadores já existentes
      no motor de regras) apenas quando o padrão é consistente no histórico.
- [x] Migração `ai_rule_meta` (rationale, amostras, estatísticas de precisão) + lockstep.
- [x] UI de aprovação em lote: regras nascem como proposta, nunca ativas
      direto; usuário revisa com o rationale e as transações-amostra ao lado.
- [x] Feedback loop: decisões do usuário (Fase 1) disparam nova rodada do
      minerador a cada cinco evidências acumuladas, para propor regra nova ou
      ajuste de regra existente.

Critério de saída: rodada de mineração no histórico real propõe regras que,
aprovadas, reduzem mensuravelmente o volume que chega ao classificador
(comparar `ai_runs` antes/depois). A implementação está concluída; essa medição
depende de uma rodada acompanhada em dados reais.

## Fase 3 — Auditor por amostragem

Fecha o trio regras → auditoria → especialista com custo sob controle.

Entregáveis:

- [x] Agente `auditor` (workflow, tier fast): valida hits reais do motor de
      regras por amostragem — 100% em regra nova, decaindo até 2–5% conforme
      a precisão observada em `ai_rule_meta` sobe; correção do usuário reseta
      a taxa.
- [x] Hit reprovado pelo auditor cai no classificador (Fase 1) e gera
      pendência.
- [x] Painel de saúde das regras: precisão observada, últimos falsos
      positivos, regra candidata a revisão.
- [x] Evals determinísticos rodando em CI local (vitest) contra o contrato do
      golden set; casos reais são materializados de `ai_feedback`.

Critério de saída: taxa de auditoria média das regras maduras < 10% dos hits,
sem queda de precisão no golden set. A política de 2–5% e a regressão do golden
set estão cobertas por testes; a observação longitudinal depende de regras
maduras em uso real.

## Fase 4 — Consultor financeiro

Agente conversacional personalizado e longitudinal. A arquitetura de memória
está definida em [ADR-001](./ADR-001-ADVISOR-MEMORY.md), a especificação em
[PHASE-4-SPEC.md](./PHASE-4-SPEC.md) e os gates em
[PHASE-4-PLAN.md](./PHASE-4-PLAN.md).

Entregáveis:

- [x] **4A — Memória consultiva**: conversas, fatos confirmáveis, objetivos,
      documentos, recomendações e follow-ups persistidos local-first.
- [x] **4B — Harness conversacional**: agente `advisor` no tier frontier,
      `runAgentLoop`, streaming, cancelamento, tool registry e limites.
- [x] **4C — Tools read-only**: transações, orçamento, fluxo de caixa, contas,
      patrimônio, faturas e contexto pessoal por contratos tipados; nunca
      SQL/AQL arbitrário gerado pelo modelo.
- [x] **4D — Experiência de conversa**: chat persistente, fontes, atividades de
      tools, gestão de memória e confirmação explícita de novas informações.
- [x] **4E — Recuperação e acompanhamento**: RAG híbrido sobre documentos e
      episódios, questões abertas, revisões de objetivos e ledger de conselho.

Critério de saída: uma conversa retomável combina dados financeiros exatos e
contexto de vida confirmado em uma resposta transmitida progressivamente,
explica fontes e premissas, registra custo e não altera o domínio financeiro.
Implementação, smoke test e aceite operacional com orçamento sincronizado e
Ollama local concluídos em 24/07/2026.

## Fase 5 — Classifier 2.0

Semântica editável, contexto relevante e consistência do classificador, com
pesquisa web restrita para estabelecimentos ambíguos. A especificação está em
[PHASE-5-SPEC.md](./PHASE-5-SPEC.md), o plano em
[PHASE-5-PLAN.md](./PHASE-5-PLAN.md) e as decisões em
[ADR-004](./ADR-004-CLASSIFIER-CONTEXT-AND-WEB-RESEARCH.md). O resultado está
registrado em [PHASE-5-RESULT.md](./PHASE-5-RESULT.md).

Entregáveis:

- [x] Dicionário local-first de descrições por categoria e CRUD responsivo.
- [x] Prompt com taxonomia semântica completa e prefixo cacheável.
- [x] Retrieval de feedback/sugestões relacionadas, incluindo evidência
      positiva e negativa.
- [x] `imported_payee`, clustering intralote, validação de IDs e gate de
      conflitos.
- [x] Pesquisa Brave opt-in pelo proxy da VM, com PII, allowlist, limites,
      cache e segunda passagem estruturada.

Critério de saída: lançamentos equivalentes do mesmo estabelecimento não são
autoaplicados em categorias contraditórias; descrições e feedback humano
orientam a decisão; pesquisa web ocorre somente por escalada e sem ampliar a
superfície de proxy. Implementação, regressões, build Linux e smoke operacional
concluídos em 25/07/2026; ganho de cache e precisão longitudinal serão medidos
em uso real.

## Riscos e mitigação

| Risco                                         | Mitigação                                                                                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custo descontrolado em históricos grandes     | Limites por run/dia (Fase 0) antes de qualquer agente; lote + cache; mineração processa em janelas                                                                     |
| Classificação errada aplicada automaticamente | Limiar de confiança configurável, marcação visual de origem IA, reversível em 1 clique no inbox                                                                        |
| Regressão silenciosa ao trocar modelo/prompt  | Golden set de evals a partir das correções reais (Fase 1+)                                                                                                             |
| Payload de PII para nuvem                     | Redação por padrão + modo somente-Ollama                                                                                                                               |
| Divergência com upstream                      | Código novo em `packages/ai-core` e módulos novos (`server/ai/`, `app-ai`); arquivos compartilhados recebem só deltas aditivos — mesmo contrato do trabalho de cartões |
