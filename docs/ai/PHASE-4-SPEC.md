# Fase 4 — Especificação do consultor financeiro

## Objetivo

Entregar um consultor financeiro conversacional, personalizado e longitudinal,
capaz de combinar dados financeiros exatos com o contexto de vida confirmado
do usuário. A primeira versão é read-only para o domínio financeiro.

## Princípios do produto

1. O consultor pergunta quando faltam informações relevantes.
2. Recomendações ligam objetivos, restrições, dados e premissas.
3. O usuário controla o que o sistema lembra.
4. Dados financeiros são consultados na fonte, nunca recuperados por
   similaridade.
5. Memórias e documentos preservam proveniência e validade temporal.
6. Toda resposta consultiva explicita incertezas e próximos passos.

## Entregáveis

### 4A — Memória consultiva

- Conversas e mensagens persistentes.
- Fatos pessoais versionados e confirmáveis.
- Objetivos financeiros e revisões.
- Ledger de recomendações, decisões e follow-ups.
- CRUD de memória com visualização, correção e exclusão.

### 4B — Harness conversacional

- Agente `advisor`, tier frontier.
- `runAgentLoop` com streaming, cancelamento e limite de passos.
- Tool registry tipado com distinção `read`/`write`.
- Telemetria consolidada em `ai_runs`.
- Eventos de texto, tool-call, tool-result, memória proposta, conclusão e erro.

### 4C — Tools financeiras read-only

- Snapshot de contas e patrimônio.
- Fluxo de caixa por período.
- Gastos por categoria.
- Busca de transações para drill-down, com cobertura explícita.
- Resumo do orçamento mensal.
- Faturas de cartões com proveniência do saldo.
- Catálogo de datasets e semânticas financeiras canônicas.
- Executor analítico adaptativo declarativo para filtros, dimensões, métricas,
  cálculos, comparações e paginação.
- Agregações completas sobre todo o conjunto filtrado.
- Perfil, objetivos, recomendações e documentos relevantes.

O modelo nunca recebe SQL/AQL arbitrário nem nomes de tabelas físicas. Ele
constrói a análise numa linguagem allowlisted que o backend compila para
consultas read-only parametrizadas.

### 4D — Experiência de conversa

- Entrada “Consultor” na navegação.
- Lista e criação de conversas.
- Streaming incremental da resposta.
- Exibição das fontes e tools utilizadas.
- Cancelamento de execução.
- Revisão dos candidatos de memória.
- Gestão do perfil, objetivos, documentos e histórico.

### 4E — Recuperação e acompanhamento

- Chunking local de notas/documentos.
- Recuperação híbrida lexical + metadados com citações.
- Resumos episódicos e questões abertas.
- Follow-ups e revisões de objetivos.
- Testes de continuidade, contradição, expiração, exclusão e isolamento.

### 4F — Transparência da execução

- Rastro operacional semântico durante a resposta.
- Etapas tipadas de contexto, planejamento, tools, cobertura, recuperação e
  composição.
- Metadados estruturais sanitizados no core.
- Timeline expandida durante a execução e recolhida automaticamente ao concluir.
- Rastro persistente e reabrível no histórico.
- Nenhuma exposição de chain-of-thought, prompts, consultas ou payloads brutos.

## Requisitos não funcionais

- Local-first e sincronizável pelo CRDT.
- Nenhuma chave de provider no cliente.
- Limites de custo por execução e por dia.
- Limite de 12 passos por rodada.
- Cobertura estruturada para toda saída limitada.
- Limites de período, paginação e execução tratados internamente pelo harness.
- Resultados de tools compactos e estruturados.
- Falha fechada para tools desconhecidas ou mutantes.
- Eventos e payloads structured-cloneable.

## Critério de saída

Com um orçamento real aberto, o usuário consegue:

1. criar uma conversa;
2. informar contexto pessoal e confirmar o que será lembrado;
3. perguntar sobre uma decisão financeira;
4. receber uma resposta em streaming que combine tools financeiras e memórias;
5. identificar dados, documentos e premissas usados;
6. retomar a conversa em outra sessão;
7. revisar ou excluir fatos, objetivos, documentos e conversa;
8. verificar custo e execução em `ai_runs`;
9. confirmar que nenhuma transação, orçamento ou conta foi alterada.
10. formular uma análise não prevista combinando campos e métricas do catálogo;
11. confirmar que agregações consideram todas as linhas filtradas;
12. não receber detalhes de paginação ou limites internos na resposta;
13. acompanhar o rastro seguro enquanto a resposta é construída;
14. reabrir o rastro depois da conclusão sem encontrar dados sensíveis ou
    raciocínio interno bruto.
