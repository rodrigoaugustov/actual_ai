# Fase 4 — Resultado

Data: 2026-07-24

## Resultado funcional

A Fase 4 entrega um consultor financeiro conversacional com:

- conversas e mensagens persistentes;
- perfil longitudinal com candidatos de memória e confirmação humana;
- objetivos, documentos e ledger de recomendações;
- resumo episódico por conversa e recuperação lexical limitada;
- agente frontier com streaming, cancelamento e até doze passos;
- tools tipadas para patrimônio, fluxo de caixa, categorias, transações,
  orçamento mensal, faturas e análise adaptativa;
- propostas de memória e conselho que não entram em vigor sem decisão do
  usuário;
- navegação, chat, atividade de tools, fontes, perfil, objetivos, documentos e
  plano na interface;
- bloqueio padrão de fatos sensíveis nos prompts, com opt-in explícito;
- telemetria consolidada em `ai_runs`.

O domínio financeiro permanece read-only. O modelo não recebe SQL/AQL
arbitrário e não dispõe de tools para alterar contas, transações ou orçamento.

## Evolução — análise adaptativa

O consultor agora recebe uma linguagem analítica geral, não um novo handler
para cada pergunta. Ele pode combinar:

- quatro datasets semânticos: transações, faturas, contas e orçamento mensal;
- filtros, dimensões, métricas condicionais, participação no total e cálculos;
- exemplos reutilizáveis para aprender a compor consultas;
- evidência de cobertura, granularidade, semântica e proveniência.

O executor compila somente fontes e campos allowlisted, parametriza valores e
não aceita SQL do modelo. Agregações examinam todo o conjunto filtrado; limites
de saída ficam no harness e não são apresentados como limitação da análise.

O loop também:

- repara argumentos inválidos sob schema estrito, com limite de tentativas;
- devolve erros semânticos conhecidos como orientação segura para nova
  tentativa;
- exige `run_financial_analysis` depois do catálogo em uma análise;
- continua uma vez quando o provider encerra após uma tool sem gerar texto;
- rejeita respostas vazias e orienta o modelo a não usar placeholders nem
  expor detalhes internos.

## Evidências automatizadas

- `@actual-app/ai`: 15 arquivos e 60 testes aprovados, incluindo reparação de
  tool call, follow-up obrigatório e recuperação de resposta vazia.
- `@actual-app/core/src/server/ai`: 16 arquivos e 78 testes aprovados.
- O executor adaptativo tem testes de catálogo, cobertura acima de 100 linhas,
  métricas condicionais, cálculos, concentração, faturas, orçamento,
  fail-closed e tentativa de injeção.
- `yarn typecheck` completo aprovado em todos os workspaces.
- `oxfmt --check` e `oxlint` aprovados nos arquivos da Fase 4.
- Build browser e build sync-server aprovados.

A suíte global chegou a 1.142 testes aprovados. Dois testes preexistentes de
`packages/loot-core/src/server/main.test.ts` falharam no Windows por bloqueio
do arquivo SQLite da fixture (`EBUSY`/`EEXIST`); os testes adaptativos passaram
dentro da execução global e a suíte web do core passou com 9 testes. Os testes
não foram enfraquecidos para contornar o lock.

## Evidência operacional

A imagem `actual-ai-server:local` foi reconstruída e o compose principal ficou
saudável em `http://localhost:5006`, preservando
`packages/sync-server/actual-data/`.

Em uma instância isolada da mesma imagem, o smoke test inicial com orçamento de
demonstração confirmou:

1. entrada “Consultor financeiro” na navegação e interface da página em
   português;
2. criação automática e manual de conversas;
3. criação de memória candidata;
4. confirmação explícita e exibição no perfil;
5. criação e persistência de objetivo;
6. bloqueio claro quando IA está desabilitada;
7. ausência de mutação financeira durante o fluxo.

O aceite operacional final foi executado em uma segunda instância isolada,
autenticada e sincronizada, usando o provider Ollama local com o modelo
`gemma4:12b`, sem credenciais de nuvem nem dados do orçamento do usuário. O
orçamento de aceite continha uma conta com saldo de R$ 10.000, uma memória
confirmada, um objetivo e um documento de premissas.

O fluxo real confirmou:

1. resposta progressiva e cancelável;
2. chamada à tool `get_financial_snapshot`;
3. uso do saldo exato de R$ 10.000;
4. combinação da memória, objetivo e documento na recomendação;
5. exibição da tool e das fontes utilizadas;
6. conclusão, riscos, alternativas, próximos passos e perguntas completas;
7. retomada das conversas e do contexto em outra sessão;
8. duas execuções `advisor / frontier / ollama · gemma4:12b` com status `ok`
   na tela **AI Usage**;
9. saldo preservado em R$ 10.000 antes e depois da consultoria.

Durante o aceite, a primeira resposta atingiu o limite de 1.800 tokens e
terminou incompleta. O limite do agente foi ampliado para 3.200 tokens e o
prompt passou a exigir uma resposta completa de até 700 palavras, priorizando
conclusão e próximos passos. A mesma pergunta foi repetida na imagem
reconstruída e terminou corretamente.

Os contêineres de aceite foram removidos após a validação. O compose principal
permaneceu saudável em `http://localhost:5006`.

### Aceite da análise adaptativa

A imagem foi reconstruída novamente após a evolução analítica e validada com o
provider Ollama real (`gemma4:12b`) na fixture isolada. O fluxo confirmou:

1. consulta ao catálogo semântico;
2. execução obrigatória de `run_financial_analysis`;
3. nova tentativa após consulta inválida;
4. síntese final sem mensagem de limite de software, sem SQL e sem
   placeholders;
5. persistência da atividade das tools e resposta formatada;
6. contabilização das chamadas suplementares no uso consolidado.

O smoke também evidenciou um limite de qualidade do modelo local: ele combinou
premissas confirmadas do perfil (renda e despesas declaradas) com o recorte sem
movimentações da fixture. O prompt agora proíbe tratar atividade zero como
estabilidade ou diversificação e exige separar dado observado de premissa. Esse
comportamento deve permanecer em avaliações comparativas de providers; não é
um limite do executor analítico.

O contêiner isolado foi removido. O compose principal, já com a imagem final,
permaneceu saudável em `http://localhost:5006`.

## Evolução — transparência segura da execução

O consultor passou a publicar e persistir um rastro operacional semântico. A
timeline mostra ao usuário, em linguagem de produto, quando o harness está
recuperando contexto, planejando, usando uma ferramenta, verificando cobertura,
corrigindo uma tentativa ou compondo a resposta.

Durante a execução, a timeline permanece expandida. Ao chegar a resposta final,
ela é recolhida automaticamente e pode ser reaberta no histórico. O core
sanitiza os metadados antes de persistir ou transmitir: são permitidos somente
estrutura da análise, períodos, campos, métricas, operadores, contagens,
cobertura, tentativa e duração.

Não são expostos chain-of-thought, prompt de sistema, SQL/AQL, consultas livres,
valores de filtros, identificadores, conteúdo de memórias ou resultados brutos
das tools. A decisão está registrada em
[ADR-003-SAFE-ADVISOR-TRACE.md](./ADR-003-SAFE-ADVISOR-TRACE.md).

Os testes focados cobrem os eventos do loop, a sanitização, persistência,
streaming e o comportamento expandir/recolher da interface.

O aceite operacional foi executado na imagem Docker reconstruída, em uma
fixture isolada e autenticada com Ollama `gemma4:12b`. Durante uma consulta real,
foi confirmado:

1. timeline aberta automaticamente durante a execução;
2. etapas de contexto, planejamento, tool, recuperação e composição;
3. chamada a `get_financial_snapshot` exibida como “Revisando saldos e
   patrimônio líquido”;
4. exibição somente de contagens e durações sanitizadas;
5. recolhimento automático após o evento terminal;
6. reabertura do rastro completo e persistido;
7. ausência de IDs, payloads brutos, consultas, valores de filtros e conteúdo de
   memória no rastro.

O provider local apresentou alta latência e encerrou a resposta textual com uma
frase incompleta. Isso não impediu a validação do rastro, mas permanece como
limite de qualidade do modelo local a ser acompanhado nas avaliações de
providers. O contêiner isolado foi removido após o aceite e o compose principal
permaneceu saudável em `http://localhost:5006`.
