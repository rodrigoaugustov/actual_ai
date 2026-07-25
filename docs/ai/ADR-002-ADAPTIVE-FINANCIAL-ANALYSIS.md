# ADR-002 — Análise financeira adaptativa e determinística

- Status: aceito
- Data: 2026-07-24
- Fase: 4

## Contexto

A primeira versão do consultor expôs tools específicas para snapshot, fluxo de
caixa, categorias, transações, orçamento e faturas. Essa abordagem é segura e
funciona para perguntas previstas, mas cria dois problemas:

1. análises novas exigiriam uma tool nova no código;
2. o agente tentava usar buscas limitadas de transações para responder
   perguntas agregadas e acabava expondo limites internos ao usuário.

O objetivo do produto é permitir que o consultor formule análises complexas e
personalizadas, não apenas selecione relatórios previamente implementados.
Ainda assim, o modelo não pode executar SQL livre sobre o banco canônico nem
reinterpretar regras contábeis como transferências, faturas e saldos.

## Decisão

Adotar uma arquitetura híbrida com três camadas.

### 1. Semântica financeira canônica

O backend continua responsável por conceitos que precisam ser autoritativos:

- valor assinado e unidade monetária;
- transferências e saldos iniciais;
- fluxo de caixa dentro do orçamento;
- pertencimento de transações a faturas;
- saldo de fatura informado pela instituição ou calculado;
- orçamento e atividade por competência;
- saldo atual das contas.

Essas regras são publicadas em datasets semânticos. O agente consulta nomes,
tipos, granularidade e definições, mas não recebe nomes de tabelas físicas nem
detalhes de joins.

### 2. Linguagem analítica adaptativa

O agente constrói consultas declarativas usando:

- dataset;
- campos para inspeção;
- dimensões de agrupamento;
- filtros globais com composição `all`/`any`;
- métricas `count`, `count_distinct`, `sum`, `average`, `min`, `max` e
  `share_of_total`;
- filtros condicionais por métrica;
- cálculos `add`, `subtract`, `multiply`, `divide` e
  `percentage_change`;
- ordenação e paginação.

O compilador resolve apenas datasets e campos allowlisted e parametriza todos
os valores. Não existe caminho na linguagem para fornecer SQL, nome de tabela,
função arbitrária, subconsulta, escrita, acesso ao filesystem ou rede.

O catálogo inclui exemplos de composição, como fluxo de caixa mensal com taxa
de poupança e concentração de despesas por beneficiário. Eles ensinam a
linguagem sem transformar perguntas específicas em novas tools.

### 3. Cobertura e evidência

Cada execução retorna:

- linhas resultantes;
- quantidade de linhas-fonte examinadas;
- quantidade total e devolvida de resultados;
- `complete`, `hasMore`, `nextOffset` e `aggregationComplete`;
- dataset, granularidade e semânticas canônicas;
- consulta declarativa executada e horário.

Agregações examinam todo o conjunto filtrado mesmo quando a saída de linhas é
limitada. Se uma inspeção ou agrupamento ficar incompleto, o agente deve
refinar, agregar, dividir ou continuar internamente antes de formular uma
conclusão.

Limites de paginação, contexto, execução e quantidade de passos são detalhes
internos e não aparecem na resposta ao usuário.

## Recuperação do loop

Chamadas fora do schema podem ser reparadas pelo modelo sob o mesmo schema
estrito, com no máximo duas tentativas. Erros semânticos conhecidos não
executam consulta parcial: retornam um resultado estruturado e seguro para que
o agente revise campos, aliases ou operandos.

Quando o agente consulta o catálogo para uma análise, o harness exige uma
execução adaptativa subsequente. Se um provider encerrar uma rodada logo após
o resultado de uma tool sem produzir a síntese, o loop faz uma única
continuação sem tools usando os resultados já obtidos. Se ela também vier
vazia, a execução falha explicitamente em vez de persistir uma resposta em
branco.

Tokens consumidos na reparação e na continuação entram no uso consolidado da
execução.

## Segurança

- A ferramenta é `read`.
- O compilador gera `SELECT` sobre fontes fixas.
- Campos, aliases, operadores, métricas e cálculos são validados por schema.
- Valores entram apenas como parâmetros SQL.
- Campos físicos sensíveis e metadados internos não são publicados
  implicitamente.
- Erros de consulta são fail-closed.
- Falhas conhecidas devolvem apenas códigos e orientação sem SQL físico.
- Ordenação por cálculo exige resultado intermediário limitado e solicita
  refinamento quando necessário.
- Toda chamada e resultado permanece persistida nas partes da mensagem e nos
  registros de execução existentes.

## Relação com tools canônicas

Tools como snapshot e faturas não são removidas. Elas permanecem como atalhos
autoritativos para conceitos de domínio conhecidos. A ferramenta adaptativa é
usada para combinações, tendências, segmentações, comparações e perguntas que
não foram previstas.

Buscas de transações servem para drill-down e exemplos. Totais, médias e
tendências devem ser calculados pelo executor adaptativo.

## Consequências

### Positivas

- novas análises não exigem um handler por pergunta;
- execução numérica reproduzível;
- regras contábeis continuam centralizadas;
- menor envio de transações cruas ao modelo;
- cobertura explícita impede conclusões silenciosamente parciais;
- a mesma linguagem funciona com qualquer provider.

### Custos

- o catálogo semântico precisa evoluir junto com o domínio;
- consultas geradas exigem avaliações de qualidade;
- perguntas que dependem de dados ainda não publicados no catálogo continuam
  pedindo evolução do dataset, não uma tool de resposta pronta;
- o agente pode precisar de mais de uma rodada para refinar uma análise.

## Alternativas rejeitadas

### Uma tool determinística por pergunta

Segura, mas transforma o consultor em uma interface de relatórios fixos e não
escala para análises consultivas personalizadas.

### SQL livre no SQLite canônico

Expressivo, mas uma validação incompleta poderia permitir escrita, acesso a
tabelas internas, consultas muito caras ou exfiltração de campos não
publicados.

### Entregar todas as transações ao modelo

Perde completude com paginação, aumenta custo e transfere cálculos exatos para
um componente probabilístico.
