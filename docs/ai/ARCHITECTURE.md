# Arquitetura de IA — Actual (fork)

Documento de arquitetura para as funcionalidades de IA deste fork: classificação
híbrida (regras + LLM), mineração de regras, auditoria e, futuramente, o
consultor financeiro conversacional. O roadmap de entregas está em
[ROADMAP.md](./ROADMAP.md).

## Princípios

1. **Local-first preservado.** Os dados do orçamento vivem no SQLite do cliente
   (loot-core); o sync-server só conhece blobs CRDT. Nenhum agente roda onde os
   dados não estão. O único dado que sai do cliente é o conteúdo das chamadas
   LLM, explícitas e visíveis.
2. **LLM-agnóstico.** Qualquer provider (OpenAI, Anthropic, Google, OpenRouter,
   Ollama) é plugável por configuração, sem mudança de código nos agentes.
3. **Custo é requisito de primeira classe.** Lote > chamada unitária; cache de
   prompt estruturado desde o dia 1; cache local de respostas; tiering de
   modelo por tarefa; auditoria por amostragem; telemetria de tokens/custo
   visível ao usuário.
4. **Modular.** Agente = configuração declarativa (prompt, tools, modelo,
   schema de saída), não classe. Tool = contrato com schema; a implementação é
   injetada pelo host. Adicionar um agente ou tool não toca a harness.
5. **Workflows onde o fluxo é conhecido; loop agêntico só onde é aberto.**
   Classificação, auditoria e mineração são pipelines determinísticas com
   passos LLM (baratas, previsíveis, testáveis). Só o consultor financeiro
   usa loop de tool-use.

## Decisões registradas

| #   | Decisão                                                                                        | Justificativa                                                                                                                                                                                                                  | Trade-off aceito                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Camada de providers = **Vercel AI SDK core** (`ai` + `@ai-sdk/*`)                              | Adapters prontos e mantidos para todos os providers-alvo, com tool-calling, streaming, saída estruturada (Zod) e controles de prompt cache expostos. A harness (orquestração, custo, auditoria) continua 100% nossa, por cima. | Dependência de terceiro na borda; mitigada por a interface da harness não vazar tipos do SDK.                                                               |
| D2  | Orquestração roda **no cliente (loot-core)**; sync-server é só **proxy de chaves + streaming** | Os dados estão no cliente; tools viram funções internas/AQL e os resultados entram no CRDT pelo caminho normal (`batchUpdateTransactions` etc.). O servidor não teria como consultar nada.                                     | Jobs só rodam com o app aberto — mesmo modelo do bank sync hoje. Se um dia precisarmos de autonomia real, extrai-se um runner separado sem mudar a harness. |
| D3  | MVP = **triagem pós-sync**                                                                     | Valor imediato no uso real (Pluggy já sincroniza diariamente) e exercita a harness inteira de ponta a ponta.                                                                                                                   | Wizard de onboarding e mineração vêm depois, reusando a mesma infra.                                                                                        |

## Topologia

```
┌────────────────────────────────────────────────────────────┐
│ desktop-client (React)                                     │
│   settings de IA · inbox de revisão · aprovação de regras  │
│   (futuro: chat do consultor)                              │
└───────────────┬────────────────────────────────────────────┘
                │ send('ai/...')
┌───────────────▼────────────────────────────────────────────┐
│ loot-core — packages/loot-core/src/server/ai/              │
│   handlers · implementações das tools (AQL/db) ·           │
│   hook pós-bank-sync · migrações (ai_runs, ai_suggestions, │
│   ai_rule_meta, ai_feedback, ai_rule_hits)                  │
└───────────────┬────────────────────────────────────────────┘
                │ usa
┌───────────────▼────────────────────────────────────────────┐
│ @actual-app/ai (packages/ai-core) — harness pura           │
│   registry de modelos · definição de agentes · runner de   │
│   workflow · loop agêntico · custo/limites · cache ·       │
│   redação de PII · evals                                   │
└───────────────┬────────────────────────────────────────────┘
                │ HTTP streaming (baseURL = proxy)
┌───────────────▼────────────────────────────────────────────┐
│ sync-server — app-ai (/ai/proxy/:provider/*)               │
│   injeta a chave (secrets service existente) · allowlist   │
│   de hosts · passthrough SSE · sem estado                  │
└───────────────┬────────────────────────────────────────────┘
                │
     OpenAI · Anthropic · Google · OpenRouter · Ollama
```

## Pacote novo: `packages/ai-core` (`@actual-app/ai`)

TypeScript puro, plataforma-agnóstico (roda no web worker do browser e no
Electron), **sem** dependência de DB, React ou loot-core. Módulos:

### `providers/` — registry de modelos e tiers

- Constrói instâncias do AI SDK apontando o `baseURL` para o proxy do
  sync-server (a chave nunca chega ao cliente).
- Ollama entra via provider OpenAI-compatible contra o endpoint do Ollama
  (o proxy resolve o host configurado, o que também elimina CORS).
- **Tiering por tarefa**, configurável pelo usuário:

  | Tier       | Uso                                            | Exemplo de default                             |
  | ---------- | ---------------------------------------------- | ---------------------------------------------- |
  | `fast`     | validação/auditoria, dedupe, extrações simples | claude-haiku / gpt-mini / flash / modelo local |
  | `standard` | classificação em lote, mineração de regras     | claude-sonnet / gpt / gemini-pro               |
  | `frontier` | consultor e casos ambíguos escalados           | melhor modelo disponível do provider           |

  Agentes declaram o tier, nunca um modelo. Trocar de provider ou modelo é
  configuração, não código.

### `agents/` — definição declarativa

```ts
type AgentDefinition = {
  name: string;
  tier: 'fast' | 'standard' | 'frontier';
  // Blocos ordenados do estável ao variável, para maximizar prompt cache:
  // [instruções fixas] [contexto semi-estável: árvore de categorias, digest
  // de regras] [variável: o lote da vez]
  promptBlocks: PromptBlock[];
  tools?: ToolRef[]; // só agentes de loop usam
  outputSchema?: ZodSchema; // workflows usam saída estruturada
  limits: { maxSteps?: number; maxTokensPerRun?: number };
};
```

### `tools/` — contrato, não implementação

```ts
type ToolSpec<In, Out> = {
  name: string;
  description: string;
  inputSchema: ZodSchema<In>;
  // readonly vs mutating: tools mutantes exigem confirmação do usuário
  // quando chamadas pelo agente conversacional.
  access: 'read' | 'write';
};
```

O ai-core define os contratos; o **loot-core injeta os handlers** (AQL,
`batchUpdateTransactions`, criação de regras). Isso mantém a harness testável
com handlers fake e impede o pacote de conhecer o schema do banco.

### `runner/` — dois modos de execução

- **`runWorkflow`**: pipeline determinística com passos LLM (classificação,
  auditoria, mineração). Sem loop, sem decisão de controle pelo modelo —
  entrada → prompt → saída estruturada validada por Zod → política de decisão
  em código.
- **`runAgentLoop`**: loop de tool-use com orçamento de passos e tokens, para
  o consultor. Streaming de texto e de chamadas de tool para a UI.

### `cost/` — contabilidade e limites

- Cada execução registra tokens (input/output/cache-read/cache-write), modelo,
  duração e custo estimado (tabela de preços por modelo, editável).
- Limites: orçamento por execução e por dia; estouro curto-circuita com erro
  claro em vez de continuar gastando.

### `cache/` — duas camadas

1. **Prompt cache dos providers**: os `promptBlocks` são serializados na ordem
   estável→variável; no Anthropic aplica-se `cache_control` no fim dos blocos
   estáveis, OpenAI/Gemini fazem cache automático por prefixo. Em lotes
   consecutivos (ex.: triagem de 200 transações em 4 chamadas), só o lote
   varia.
2. **Cache local de decisões confirmadas**: hash de (payee normalizado, faixa
   de valor, conta) → categoria com consenso humano. Rejeições contam como
   evidência negativa e podem invalidar o consenso. Transação repetida nem
   chega ao LLM. As regras já capturam a maior parte disso, mas o cache cobre o
   intervalo entre "payee novo apareceu" e "regra minerada e aprovada".

### `redact/` — privacidade antes do envio

Scrub por regex de números de conta, documentos (CPF/CNPJ), cartões e chaves
PIX em `notes`/`imported_payee` antes de qualquer chamada. Ligado por padrão.
Modo "somente local" (Ollama) disponível na configuração para quem não quer
nenhum dado em nuvem.

### `evals/` — regressão de prompts e modelos

Golden set construído a partir das decisões reais do usuário (aceites,
correções, rejeições e classificações manuais viram casos). O contrato e o
scorer rodam em vitest e reportam precisão, cobertura e regressões; os casos
locais são materializados de `ai_feedback`.

## Integração no loot-core: `src/server/ai/`

Segue o padrão do módulo `credit-cards/` (app com handlers, registrado em
`main.ts`):

- **`app.ts`** — handlers: `ai/get-config`, `ai/update-config`,
  `ai/classify-pending`, `ai/get-suggestions`, `ai/resolve-suggestion`
  (aceitar/corrigir/rejeitar), `ai/mine-rules` (Fase 2), `ai/audit-sample`
  (Fase 3), `ai/chat` (Fase 4).
- **`tools-impl.ts`** — implementações reais das tools sobre AQL/db.
- **Hook pós-sync** — no mesmo ponto onde hoje chamamos `syncPluggyBills` em
  `accounts/sync.ts`: ao fim do sync, dispara a triagem dos não-categorizados
  (fire-and-forget, como os demais pós-processamentos).

### Migrações (aditivas, padrão do fork)

| Tabela           | Papel                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai_runs`        | Log de execuções: agente, modelo, tokens, custo estimado, duração, status. Fonte da telemetria de custo e da auditoria ("por que a IA fez X?").                                                         |
| `ai_suggestions` | Sidecar por transação: categoria sugerida, confiança, rationale curto, status (`pending` / `accepted` / `rejected` / `auto_applied`), run de origem. Não polui `transactions`; o register junta por id. |
| `ai_rule_meta`   | Sidecar por regra: rationale legível, transações-amostra usadas na mineração, run de origem, e estatísticas de precisão (hits, confirmados, corrigidos). Evita alterar a tabela `rules` do upstream.    |
| `ai_feedback`    | Golden set persistente das decisões humanas: aceite, correção, rejeição, classificação manual e override de autoaplicação.                                                                              |
| `ai_rule_hits`   | Hits reais das regras mineradas, com estado de amostragem e resultado da auditoria.                                                                                                                     |

Todas com `tombstone`, sincronizadas pelo CRDT como qualquer tabela (mesmo
mecanismo validado com `statements`). Lockstep habitual: `db/types`,
`types/models/`, AQL schema.

### Política de confiança da classificação

| Confiança                    | Ação                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Alta (≥ limiar configurável) | Aplica a categoria e grava suggestion `auto_applied` — reversível e visivelmente marcada como origem-IA no register. |
| Média                        | Não aplica; grava `pending` com a sugestão preenchida — aparece no inbox de revisão.                                 |
| Baixa                        | Não sugere; transação segue não-categorizada normal.                                                                 |

Correção do usuário (no inbox ou direto no register) gera dois efeitos:
alimenta o golden set de evals e entra na fila de propostas do minerador de
regras (feedback loop).

## sync-server: `app-ai`

Sub-app Express no padrão do `app-pluggyai`:

- **`/ai/proxy/:provider/*`** — reverse proxy autenticado pela sessão Actual:
  resolve o host real por allowlist (`api.openai.com`, `api.anthropic.com`,
  `generativelanguage.googleapis.com`, `openrouter.ai`, host do Ollama
  configurado), injeta a chave do secrets service, repassa o corpo e faz
  passthrough do streaming SSE. **Sem estado e sem lógica de LLM** — toda a
  inteligência fica no cliente.
- **Chaves** — novos `SecretName` no secrets service existente
  (`ai_openai_key`, `ai_anthropic_key`, `ai_google_key`, `ai_openrouter_key`,
  `ai_ollama_url`), com suporte per-budget igual às credenciais Pluggy.

## Orquestração dos agentes de classificação

```
transações novas do bank sync
        │
        ▼
   runRules (existente, grátis)          ┌──────────────────────────┐
        │                                │ auditor (Fase 3)         │
        ├── caiu em regra ──────────────►│ amostragem por regra:    │
        │                                │ 100% regra nova → decai  │
        │                                │ até 2–5% regra madura;   │
        │                                │ correção do usuário      │
        │                                │ reseta a taxa            │
        │                                └────────┬─────────────────┘
        │                                         │ reprovado
        ▼                                         ▼
   cache local de respostas ──hit──► aplica sem LLM
        │ miss
        ▼
   classificador (tier standard, lote de até ~50, saída estruturada
   com contexto: árvore de categorias, histórico do payee,
   few-shot das correções do usuário)
        │
        ▼
   política de confiança → auto_applied / pending / nada
```

O ponto de custo mais importante: **o auditor não valida todo hit de regra**
(isso anularia a economia do híbrido). Ele amostra, com taxa por regra que
decai conforme a precisão observada em `ai_rule_meta` sobe.

## Agentes previstos

| Agente                | Modo     | Tier     | Fase |
| --------------------- | -------- | -------- | ---- |
| `classifier`          | workflow | standard | 1    |
| `rule-miner`          | workflow | standard | 2    |
| `auditor`             | workflow | fast     | 3    |
| `advisor` (consultor) | loop     | frontier | 4    |

## Segurança e privacidade

- Chaves de API nunca chegam ao cliente; o proxy injeta e a allowlist impede
  exfiltração para hosts arbitrários.
- Redação de PII ligada por padrão; modo somente-Ollama disponível.
- Tools `write` chamadas por agentes de loop (consultor) sempre exigem
  confirmação explícita do usuário na UI; o consultor nasce read-only.
- Tudo que um agente fez fica auditável em `ai_runs` + rationale nas
  suggestions/regras.

## Memória do consultor

A Fase 4 usa memória híbrida: dados financeiros continuam autoritativos no
banco e são acessados por tools read-only; perfil, objetivos, episódios,
documentos e decisões são fontes persistentes com proveniência, validade e
confirmação. Recuperação semântica é um índice derivado, nunca uma fonte de
verdade. A decisão completa está em
[ADR-001-ADVISOR-MEMORY.md](./ADR-001-ADVISOR-MEMORY.md).

## Análise financeira adaptativa

Tools canônicas continuam definindo saldos, transferências, fluxo de caixa,
orçamento e faturas, mas o consultor não depende de um handler por pergunta.
Ele pode consultar um catálogo semântico e construir análises declarativas com
filtros, dimensões, métricas condicionais e cálculos.

O host compila essa linguagem para `SELECT` parametrizado sobre datasets
allowlisted. O modelo nunca fornece SQL/AQL, tabelas físicas, joins ou funções
arbitrárias. A saída inclui cobertura e evidência; agregações examinam todo o
conjunto filtrado e paginação limita apenas as linhas devolvidas ao modelo.

Buscas de transações são usadas para drill-down. Totais e tendências usam o
executor adaptativo. Limites internos são resolvidos por refinamento,
agregação ou paginação e não são apresentados ao usuário.

A decisão e o contrato de segurança completos estão em
[ADR-002-ADAPTIVE-FINANCIAL-ANALYSIS.md](./ADR-002-ADAPTIVE-FINANCIAL-ANALYSIS.md).

## Transparência da execução do consultor

O harness transforma marcos reais da orquestração em um rastro semântico
independente do provider: compreensão, contexto, planejamento, tools, cobertura,
retry e composição. Esses eventos são sanitizados no core, transmitidos pelo
canal de eventos e persistidos como partes da mensagem.

A UI mostra a timeline aberta enquanto a execução está ativa, recolhe ao
concluir e permite reabertura no histórico. Argumentos e resultados brutos
continuam internos. O contrato completo está em
[ADR-003-SAFE-ADVISOR-TRACE.md](./ADR-003-SAFE-ADVISOR-TRACE.md).
