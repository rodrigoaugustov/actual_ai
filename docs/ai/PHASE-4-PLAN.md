# Fase 4 — Plano de execução

## Gate 1 — Contratos e persistência

- [x] ADR-001 aceita e ligada à arquitetura.
- [x] Migração das entidades consultivas.
- [x] Lockstep em tipos de DB, modelos e AQL.
- [x] Repositórios de conversa, memória, objetivos, documentos e conselho.
- [x] Testes de CRUD, versionamento, confirmação e tombstone.

## Gate 2 — Harness e tools

- [x] `ToolSpec` e registry com política de acesso.
- [x] `advisorAgent` e prompt consultivo.
- [x] `runAgentLoop` com streaming, cancelamento, limite e uso agregado.
- [x] Tools financeiras read-only limitadas.
- [x] Recuperação de memórias e documentos.
- [x] Testes com modelo e handlers fake.

## Gate 3 — Transporte e UI

- [x] Eventos push tipados para streaming.
- [x] Handlers de iniciar/cancelar/listar conversa.
- [x] Página do consultor e navegação.
- [x] Histórico, fontes, tool activity e estado de erro.
- [x] Revisão de memórias e gestão do contexto.
- [x] Testes de componentes e integração.

## Gate 4 — Qualidade consultiva

- [x] Descoberta guiada e mapa de contexto faltante.
- [x] Registro de premissas, alternativas e follow-ups.
- [x] Cenários de continuidade e contradição.
- [x] Segurança, privacidade, limites e auditoria.
- [x] Documentação operacional e de teste.

## Gate 5 — Promoção

- [x] Formatação, lint focado e typecheck.
- [x] Testes focados e suíte relevante.
- [x] Migrações e snapshots.
- [x] Build browser e sync-server.
- [x] Deploy Docker local saudável.
- [x] Smoke test end-to-end com fixture representativa.
- [x] `PHASE-4-RESULT.md` com evidências e pendências explícitas.

## Gate 6 — Análise adaptativa

- [x] ADR-002 aceita e ligada à arquitetura.
- [x] Catálogo semântico sem exposição de tabelas físicas.
- [x] Linguagem declarativa para filtros, dimensões, métricas e cálculos.
- [x] Compilação allowlisted e parametrizada, fail-closed.
- [x] Cobertura e evidência em resultados analíticos.
- [x] Proveniência autoritativa de saldos de fatura.
- [x] Guardrails contra totais derivados de buscas parciais.
- [x] Testes com mais linhas do que a saída permite.
- [x] Validação completa, build Docker e smoke test com provider real.

## Gate 7 — Transparência segura da execução

- [x] ADR-003 aceita e ligada à arquitetura.
- [x] Eventos semânticos para contexto, planejamento, tools, validação e retry.
- [x] Sanitização allowlisted antes da persistência e do transporte.
- [x] Rastro persistente junto à mensagem do consultor.
- [x] Timeline expandida durante a execução e recolhida ao concluir.
- [x] Reabertura do histórico com duração e cobertura.
- [x] Testes contra exposição de filtros, resultados e consultas livres.
- [x] Build Docker e smoke test visual com provider real.
