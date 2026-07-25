# Resultado do plano de UX de IA e cartões

Data de conclusão: 25 de julho de 2026.

## Estado

O plano registrado em
`C:\Users\rodri\.claude\plans\j-conseguimos-concluir-praticamente-binary-pearl.md`
foi concluído. Não há item funcional pendente nas Fases 1, 2 ou 3.

O backfill das 425 traduções herdadas do upstream continua fora deste plano,
como definido no próprio documento. As traduções das superfícies de IA criadas
por este fork são mantidas localmente.

## Aceite por requisito

| Requisito                    | Resultado                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 — becos sem saída        | `RuleHealthPanel`, `StatementsPanel` e `SuggestionsInbox` têm estados vazios explícitos e preservam suas ações primárias.                                                                                                                                                                                                                                                         |
| 1.2 — acesso ao uso de IA    | `/ai-usage` permanece alcançável nas configurações mesmo sem resumo; notificações de falha oferecem acesso direto ao registro.                                                                                                                                                                                                                                                    |
| 1.3 — cartão no mobile       | Configuração de fechamento e vencimento está no menu mobile, limitada a contas de crédito, e o painel exige os dois campos de forma consistente.                                                                                                                                                                                                                                  |
| 1.4 — falhas e carregamento  | Ações assíncronas de IA e cartões notificam falhas, têm proteção contra submissão concorrente e estados de carregamento. Consultas distinguem carregamento, erro e vazio; há teste específico para falha da qualidade das regras.                                                                                                                                                 |
| 1.5 — ações destrutivas      | Exclusões do consultor, desfazer parcelamento, desmarcar fatura paga e trocar regime pedem confirmação. O regime usa seleção explícita das duas opções.                                                                                                                                                                                                                           |
| 1.6 — idioma e preferências  | Superfícies do fork foram traduzidas para pt-BR, enums e agentes têm rótulos, datas respeitam o formato configurado e valores usam formatação financeira apropriada.                                                                                                                                                                                                              |
| 1.7 — parcelas               | O registro lê os campos estruturados de parcela, mostra indicador próprio e permite desfazer a compra parcelada com confirmação e tratamento de erro.                                                                                                                                                                                                                             |
| 2.1 — infraestrutura mobile  | Rotas de pendências, uso e consultor têm variantes estreitas, navegação mobile e folga para a barra inferior.                                                                                                                                                                                                                                                                     |
| 2.2 — telas mobile           | Consultor dedicado, listas em cartões, configurações empilhadas, seis superfícies de cartão alcançáveis e ações de IA no registro mobile foram entregues.                                                                                                                                                                                                                         |
| 3 — consistência e polimento | Configuração e operações têm superfícies distintas; propostas e auditoria estão no hub operacional, agora acessível pela navegação principal; origem de IA usa badge tipado; abas do consultor são semânticas e persistidas na URL; propostas mostram amostras e aceitam lote; campos persistidos de conselho e revisão são exibidos; os itens menores do plano foram corrigidos. |

## Correções pós-aceite

O retorno visual posterior ao aceite revelou seis problemas de integração
responsiva, corrigidos no mesmo marco:

1. O aviso de categorizações pendentes passou a ser exibido também no mobile,
   em fluxo normal e com acesso direto à revisão.
2. A barra mobile passou a calcular sua altura pelo número real de linhas. Um
   controle explícito de expansão tornou `Configurações` alcançável sem
   depender exclusivamente do gesto de arrastar.
3. `Operações de IA` passou a ser item principal no desktop e item de primeiro
   nível na navegação mobile. O atalho operacional foi removido das
   configurações.
4. O Plano do consultor deixou de usar listas HTML que colapsavam dentro dos
   cartões flex; detalhes, textos longos e ações agora têm altura intrínseca e
   comportamento responsivo.
5. As linhas web de categorizações pendentes deixaram de impor 32 px a células
   multilinha. A página inteira ganhou rolagem delimitada e a versão mobile
   preserva cartões e ações de toque.
6. A tela mobile de transações sem categoria passou a oferecer
   `Classificar todas com IA`, reutilizando a mesma ação e o mesmo tratamento de
   sucesso/erro do registro web.
7. Um reteste com o volume real de pendências revelou que o contêiner flex da
   página ainda comprimia a lista e os painéis de regras para a altura da
   viewport. O conteúdo passou a ter altura intrínseca e a não encolher; no web
   ele fica dentro de uma única região rolável, enquanto no mobile a rolagem é
   delegada à própria página e cada cartão permanece no fluxo normal.

Validação adicional:

- 24 testes direcionados aprovados em sete arquivos, incluindo as asserções de
  regressão para o fluxo intrínseco da lista no web e no mobile.
- Typecheck estrito do workspace web aprovado.
- Oxfmt e oxlint aprovados nos 19 arquivos do escopo. O check global continua
  encontrando a normalização de fim de linha preexistente em 392 arquivos no
  checkout Windows; nenhum desses arquivos foi mantido na alteração.
- Build de navegador aprovado com
  `yarn lage build:browser --to=@actual-app/web`.
- Navegador real validado em 390×844 e 1280×900. O menu mobile foi expandido
  pelo novo controle e abriu `Configurações`; o hub operacional foi acessado
  pela navegação principal nas duas larguras.

## Validação

- `yarn lint:fix`: concluído sem erro. O formatter global alterou
  mecanicamente arquivos fora do escopo no Windows; esse ruído foi removido e
  a árvore voltou a ficar limpa.
- `yarn typecheck`: aprovado para todos os workspaces.
- Testes focados de IA, cartões, registro e servidor: aprovados durante cada
  etapa, incluindo o teste de erro adicionado a `RuleHealthPanel`.
- `yarn test`: web, componentes e IA aprovados. No core, 91 arquivos e 1.146
  testes passaram; dois casos de `src/server/main.test.ts` reproduziram o flake
  preexistente de lock da fixture SQLite no Windows (`EBUSY`/`EEXIST`), também
  numa execução isolada.
- Build de navegador equivalente ao wrapper raiz:
  `yarn lage build:browser --to=@actual-app/web`, aprovado nos quatro
  workspaces. O wrapper `yarn build:browser` depende de `/bin/bash` e não roda
  neste host Windows.
- Build Docker Linux: `actual-ai-server:local` reconstruída com sucesso.
  O rebuild revelou e permitiu normalizar o casing físico
  `component-library/src/themes` no worktree Windows.
- Runtime: `sync-server-actual_server-1` está `running/healthy` em
  `http://localhost:5006`.
- Navegador real: fluxos internos foram exercitados em 375×812 e 1280×720,
  incluindo estados vazios, erro forçado, inglês/pt-BR, parcelamento compacto e
  ausência de overflow. Após o rebuild, o artefato servido foi novamente aberto
  nas duas larguras e reportou app/servidor v26.7.0 sem overflow.

As alterações temporárias usadas no aceite foram restauradas: IA desligada,
idioma em padrão do sistema e dias de fechamento/vencimento da conta de teste
sem valor. Os processos Vite temporários foram encerrados; o Docker foi
preservado.

## Commits

1. `0a0d9a820` — estados vazios, uso de IA e configuração mobile de cartão.
2. `d09802413` e `846624d68` — feedback de erro e carregamento.
3. `bbf3eeefe` — confirmações destrutivas e regime.
4. `31fb99426` — localização das superfícies de IA.
5. `60c191aee` — indicador e reversão de parcelas.
6. `2458ebb08` a `c137d7a53` — infraestrutura e telas mobile.
7. `2862b8c5d` — controles de IA no registro mobile.
8. `01d761c63` — arquitetura de informação, origem tipada e navegação do
   consultor.
9. `8e40e13e4` — amostras, lote, evidências persistidas e polimentos finais.
10. `c08afe04b` — distinção entre erro e vazio na qualidade das regras.
