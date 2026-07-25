# Fase 5 — Classifier 2.0 — Especificação

## Objetivo

Melhorar precisão e consistência do classificador com semântica editável de
categorias, decisões anteriores relevantes, coerência intralote e pesquisa web
restrita para estabelecimentos realmente ambíguos.

## Requisitos funcionais

1. O usuário pode criar, renomear e excluir grupos/categorias e editar uma
   descrição de até 1.000 caracteres para cada categoria na configuração de
   IA.
2. O prompt contém a taxonomia completa, com ID, caminho e descrição, em ordem
   determinística.
3. Cada candidato contém beneficiário canônico, `imported_payee`, notas,
   valor, data e cluster de estabelecimento, todos sujeitos à política de PII.
4. Feedback aceito, corrigido, rejeitado e manual do mesmo beneficiário ou de
   descrições semelhantes é recuperado por lote. Autoaplicações anteriores
   podem aparecer apenas como evidência fraca.
5. Saídas para transações ou categorias fora da entrada são ignoradas.
   Duplicatas são deduplicadas.
6. Um cluster não pode produzir autoaplicações contraditórias. Consenso
   dominante pode reconciliar a categoria; conflito sem dominância exige
   revisão humana.
7. Websearch é desligada por padrão, limitada a no máximo cinco clusters por
   lote e não bloqueia a classificação quando falha.
8. A VM aceita somente consulta, localidade e quantidade, chama host Brave
   fixo, injeta chave server-side, aplica rate limit, timeout, sanitização de
   PII e projeção de resposta.
9. Pesquisa válida é cacheada por 30 dias e reutilizada sem nova chamada.
10. Primeira e segunda passagens LLM são registradas separadamente em
    `ai_runs`.

## Requisitos não funcionais

- Local-first e sincronização CRDT para perfis e enriquecimentos.
- Nenhuma chave chega ao browser.
- Nenhum proxy ou fetch arbitrário.
- Compatibilidade com todos os providers LLM configurados no fork.
- Falha fechada para IDs inválidos e falha aberta apenas para a etapa opcional
  de pesquisa.

## Critérios de aceite

- Caso de regressão `DuoGourmet` não autoaplica categorias conflitantes.
- Alterar uma descrição modifica o contexto da próxima classificação.
- Evidência aceita e rejeitada do mesmo estabelecimento chega ao prompt.
- Pesquisa é feita uma vez por cluster ambíguo e o cache evita repetição.
- Consultas com PII chegam sanitizadas ao provedor de busca.
- Testes focados, lint, typecheck, builds browser/server e Docker passam.
