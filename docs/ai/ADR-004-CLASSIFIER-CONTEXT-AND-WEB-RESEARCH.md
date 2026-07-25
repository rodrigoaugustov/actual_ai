# ADR-004 — Contexto semântico e pesquisa web do classificador

## Status

Aceita e implementada na Fase 5.

## Contexto

O classificador da Fase 1 recebia nomes de categorias e exemplos recentes
globais. Esse contexto não explicava a semântica de cada categoria, podia
omitir decisões antigas do mesmo estabelecimento e não impunha consistência
entre lançamentos equivalentes do mesmo lote. Alguns beneficiários bancários
também não são identificáveis apenas por nome e notas.

## Decisão

1. A taxonomia completa continua no prompt. Descrições editáveis ficam em
   `ai_category_profiles`, um sidecar local-first ligado à categoria nativa.
   RAG não seleciona categorias, pois retrieval poderia omitir uma opção
   válida.
2. Retrieval local complementa o prompt com feedback e sugestões relevantes
   por beneficiário, descrição importada e notas semelhantes. Aceites,
   correções e decisões manuais são evidência forte; rejeições são negativas;
   autoaplicações anteriores são apenas evidência fraca.
3. Transações recebem um cluster determinístico de estabelecimento. O prompt
   exige consistência no cluster e código pós-LLM impede autoaplicações
   contraditórias, usando consenso apenas quando há dominância clara.
4. Pesquisa web é uma escalada opt-in e limitada. O worker consulta
   `/ai/web-search`; a VM chama somente a Brave Search API, injeta a chave,
   sanitiza a consulta e projeta título, URL HTTP(S) e snippet. Não existe
   fetch arbitrário de páginas.
5. Resultados úteis são cacheados por consulta e localidade em
   `ai_merchant_enrichments`, com TTL de 30 dias. O classificador faz uma
   segunda passagem estruturada apenas para clusters pesquisados.

## Cache de prompt

Instruções e taxonomia são prefixos estáveis e cacheáveis. Evidência local,
pesquisa e lote permanecem variáveis. Categorias são ordenadas
deterministicamente; editar a descrição altera o conteúdo e invalida
naturalmente o prefixo antigo. `ai_runs` registra tokens de leitura e escrita
de cache para medir ganho real.

## Consequências

- A classificação continua sendo workflow determinístico com Zod, não um loop
  aberto de tools.
- A VM ganha egress HTTPS para um host fixo e uma credencial opcional.
- Pesquisa adiciona custo e latência somente quando habilitada e necessária.
- Conteúdo de categoria e web é delimitado como dado não confiável, nunca como
  instrução.
- Duas tabelas aditivas aumentam o delta do fork, mas evitam alterar tabelas
  centrais do upstream.
