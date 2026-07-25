# ADR-001 — Memória e contexto do consultor financeiro

- Status: aceito
- Data: 2026-07-24
- Fase: 4

## Contexto

O consultor financeiro não pode ser apenas uma interface conversacional para
consultas que já caberiam em um dashboard. Recomendações úteis dependem do
contexto de vida do usuário: composição familiar, renda, estabilidade,
objetivos, restrições, estágio de vida, tolerância e capacidade de risco,
ambições, preocupações e decisões anteriores.

Ao mesmo tempo, saldos, transações, orçamento, contas, faturas e regras já são
dados estruturados e mutáveis. Copiá-los para uma memória textual ou vetorial
criaria uma segunda fonte de verdade sujeita a desatualização.

## Decisão

Adotar uma memória híbrida, local-first e com proveniência explícita.

### 1. Estado financeiro autoritativo

Dados financeiros atuais são sempre consultados por tools tipadas e read-only
sobre o banco do orçamento. O modelo não recebe AQL ou SQL arbitrário e não
mantém cópias desses dados como memória de longo prazo. Para análises não
previstas, ele usa a linguagem declarativa e o catálogo semântico definidos na
[ADR-002](./ADR-002-ADAPTIVE-FINANCIAL-ANALYSIS.md).

### 2. Modelo estruturado do cliente

Fatos pessoais são persistidos como registros versionados, com:

- sujeito (`household`, usuário ou dependente);
- tipo e valor estruturado;
- texto original opcional;
- origem (`user`, `conversation`, `document` ou `system`);
- confiança;
- estado de confirmação;
- sensibilidade;
- validade temporal e última confirmação;
- vínculo com a mensagem ou documento de origem;
- relação de substituição para preservar histórico.

Inferências sensíveis nunca se tornam fatos confirmados silenciosamente. O
consultor cria candidatos e a UI permite aceitar, editar ou rejeitar em lote.

### 3. Objetivos e plano

Objetivos financeiros são entidades próprias, não fragmentos de conversa.
Guardam descrição na linguagem do usuário, valor e prazo opcionais, prioridade,
flexibilidade, estado, progresso narrativo e data da próxima revisão.

Recomendações relevantes são registradas em um ledger de aconselhamento com
premissas, evidências, alternativas, riscos, decisão do usuário e follow-up.

### 4. Memória episódica

Conversas e mensagens são persistidas. Ao encerrar uma rodada, o consultor pode
produzir um resumo episódico com decisões, questões abertas e próximos passos.
O contexto de uma nova rodada usa as mensagens recentes e apenas episódios
relevantes, não o histórico completo.

### 5. Conteúdo não estruturado e RAG

Notas e documentos fornecidos pelo usuário são armazenados como fonte canônica
e divididos em chunks derivados. A recuperação inicial é híbrida:

1. filtros determinísticos por tipo, sujeito, data e documento;
2. busca lexical local com pontuação e limite;
3. recência e proveniência como critérios de desempate.

Embeddings não são requisito do MVP. Podem ser adicionados como índice derivado
e versionado quando o corpus justificar, sem substituir fatos, objetivos ou
documentos originais.

### 6. Context builder

Para cada mensagem, o host monta contexto limitado contendo:

- mensagens recentes da conversa;
- perfil e objetivos relevantes;
- questões abertas e recomendações em acompanhamento;
- trechos recuperados de documentos e episódios;
- resultados exatos das tools escolhidas pelo agente.

Todo trecho recuperado preserva identificação da fonte para que a resposta
possa explicar quais dados e premissas utilizou.

### 7. Persistência e sincronização

As fontes canônicas vivem no SQLite do orçamento e seguem o mecanismo CRDT:

- conversas e mensagens;
- fatos confirmados ou candidatos;
- objetivos;
- documentos;
- recomendações e follow-ups.

Chunks e futuros embeddings são derivados, podem ser reconstruídos e não
precisam ser sincronizados. Exclusão usa tombstones como as demais entidades.

### 8. Segurança

- Tools financeiras da primeira versão têm acesso somente de leitura.
- Toda tool possui schema, limites de período e quantidade.
- Escritas de memória são propostas e exigem confirmação explícita.
- O usuário pode visualizar, corrigir, exportar e excluir sua memória.
- Informações sensíveis ficam fora dos prompts por padrão e só são enviadas
  ao provider após opt-in explícito; continuam armazenadas e sincronizadas no
  orçamento.
- Ausência de contexto essencial deve gerar perguntas, não suposições.

## Consequências

O consultor ganha continuidade e personalização sem transformar o modelo em
fonte de verdade. A solução exige mais entidades e uma etapa de confirmação,
mas permite auditoria, correção, sincronização e evolução independente do
provider ou modelo.

## Alternativas rejeitadas

### Histórico inteiro no prompt

Não escala, aumenta custo, perde relevância e torna difícil corrigir uma
informação antiga.

### RAG vetorial sobre todos os dados

Valores financeiros exigem exatidão e atualidade. Similaridade semântica não é
adequada como fonte de saldos, totais, faturas ou orçamento.

### Resumo único livre

É simples, mas mistura fatos, inferências e opiniões sem validade temporal,
proveniência ou correção granular.
