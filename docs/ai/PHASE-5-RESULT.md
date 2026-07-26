# Fase 5 — Classifier 2.0 — Resultado

## Resultado

A Fase 5 foi implementada e validada em 25/07/2026 e compõe a versão `1.1.1`
do fork. O classificador agora combina taxonomia semântica editável, evidência
local relevante, `imported_payee`, consistência por cluster de estabelecimento
e pesquisa web opcional para casos ambíguos.

## Entregas

- Dicionário responsivo para grupos, categorias e descrições de até 1.000
  caracteres. Grupos e categorias usam as mutações nativas; descrições ficam
  no sidecar CRDT `ai_category_profiles`.
- Taxonomia completa, ordenada e delimitada no prompt. Instruções e taxonomia
  formam o prefixo estável elegível ao cache do provider; evidências, pesquisa
  e lote permanecem variáveis.
- Retrieval lexical por estabelecimento e texto semelhante, distinguindo
  confirmação/correção humana, aceite, rejeição e autoaplicação anterior.
- Cluster determinístico e reconciliação pós-modelo. IDs inventados são
  ignorados, duplicatas são resolvidas e conflitos sem consenso ficam abaixo
  do limiar de autoaplicação.
- Pesquisa Brave opt-in, limitada por lote e feita por `/ai/web-search`. O
  sync-server autentica o orçamento, mantém host fixo, injeta a chave
  server-side, sanitiza PII, aplica rate limit/timeout e devolve somente campos
  projetados.
- Cache CRDT de enriquecimento por consulta/localidade com TTL de 30 dias e
  segunda passagem registrada separadamente em `ai_runs`.

## Validação

- `yarn lint`: aprovado.
- `yarn typecheck`: aprovado em todo o monorepo.
- Testes focados: 168 aprovados entre `ai-core`, `loot-core`, interface e
  proxy.
- Build de produção do browser e do sync-server: aprovados no Windows.
- Build Docker Linux: imagem `actual-ai-server:local` construída com sucesso.
- Smoke operacional: container `healthy`, migrations concluídas e HTTP 200 em
  `http://localhost:5006`.

O `yarn test` global aprovou os workspaces de AI, interface e sync-server. No
loot-core, 1.155 testes passaram e dois casos preexistentes de
`src/server/main.test.ts` falharam exclusivamente pelo lock conhecido
`EBUSY/EEXIST` do fixture `test-budget` no Windows. Duas repetições isoladas
reproduziram o mesmo lock; não houve falha nos módulos alterados.

## Operação e medição

A pesquisa permanece desligada por padrão e exige uma chave Brave configurada
nas opções de IA. O smoke não realizou uma chamada paga real por não pressupor
essa credencial. Ganho de cache de prompt depende do provider/modelo e deve ser
medido pelos tokens de leitura/escrita de cache registrados em `ai_runs`, não
assumido apenas pela estrutura do prompt.
