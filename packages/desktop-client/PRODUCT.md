# Nosso Caderninho

<!-- impeccable:product-schema 1 -->

## Platform

web

## Usuários

O produto atende principalmente um casal que administra em conjunto as
finanças pessoais e familiares. Um dos usuários opera com maior frequência
pela Web; a outra usuária acessa exclusivamente pelo mobile.

Neste primeiro momento, uma única família utiliza e valida o produto. Uma
eventual expansão comercial é uma possibilidade futura, não uma premissa que
deva tornar a experiência inicial genérica.

Os principais trabalhos são acompanhar gastos e orçamentos, classificar
despesas, manter uma visão compartilhada da situação financeira familiar e
usar o agente de IA como apoio ao planejamento.

## Propósito do produto

Nosso Caderninho é um gestor financeiro familiar pensado desde o início para
casais administrarem, compreenderem e planejarem juntos sua vida financeira,
com continuidade entre dispositivos e sem depender de conexão permanente.

O produto tem sucesso quando as tarefas financeiras cotidianas funcionam bem
tanto na Web quanto no mobile, continuam disponíveis offline e sincronizam
corretamente quando a conexão retorna.

## Posicionamento

Uma memória financeira compartilhada da família que combina orçamento e
controle cotidiano com assistência de IA para classificação e planejamento,
mantendo os dados financeiros canônicos disponíveis localmente e sob controle
do casal.

## Contexto de uso

- O casal trabalha sobre as mesmas finanças familiares em dispositivos e
  larguras de tela diferentes.
- A Web é a superfície de uso mais frequente de um usuário; o mobile é a única
  superfície usada pela outra usuária.
- O uso inclui contas, transações, gastos, orçamentos, classificação de
  despesas e conversas com o consultor financeiro de IA.
- A alternância entre orçamentos existe e deve continuar disponível, mas é uma
  ação de baixa frequência e não precisa ocupar a navegação principal.
- Um orçamento real pode conter dezenas de contas e cartões, dezenas de
  categorias e milhares de transações em um único mês.
- A conectividade pode ser intermitente. O trabalho financeiro básico precisa
  continuar offline e sincronizar após a reconexão.
- As superfícies precisam permanecer utilizáveis com grandes volumes de dados,
  sem quebras de layout, sobreposições ou perda de ações importantes.

## Capacidades e restrições

- O aplicativo existente é um único produto React responsivo servido na Web e
  empacotado para desktop com Electron e para mobile com Capacitor.
- Uma única árvore de componentes não é um compromisso do produto. Fluxos,
  layouts e componentes podem ser especializados por contexto quando isso
  melhorar a experiência, desde que preservem a mesma realidade financeira.
- O resultado deve funcionar bem em qualquer tamanho de tela. Paridade de
  capacidade não exige composição visual idêntica entre Web e mobile.
- O sistema é local-first: permanece funcional sem internet e sincroniza as
  alterações quando a conexão retorna.
- O produto atual oferece fluxos de IA para classificação, revisão de
  sugestões, automação de regras, acompanhamento de uso e planejamento com um
  consultor financeiro.
- Múltiplos orçamentos por usuário continuam sendo uma capacidade do produto,
  embora não sejam prioridade nesta fase.
- Desempenho, legibilidade e estabilidade de layout com muitos registros são
  requisitos do produto, não casos excepcionais.

## Compromissos de marca

- O nome confirmado do produto é **Nosso Caderninho**.
- O público e o posicionamento são explicitamente centrados em casais e
  famílias, não em gestão financeira pessoal genérica.
- O território central da marca é **Parceria**.
- A promessa verbal de trabalho é **“As finanças da casa, cuidadas em
  conjunto.”**
- A voz é acolhedora, prática, colaborativa e sem julgamento ou jargão de
  fintech. A comunicação prioriza “vocês”, “nossa casa” e “planejar juntos”.
- Local-first, funcionamento offline e sincronização posterior sustentam a
  confiança na promessa, mas não precisam ser a mensagem principal.
- A metáfora do caderno representa continuidade, memória e registro
  compartilhado; ela não exige uma imitação visual literal de papel.
- A relação futura com o ecossistema Caderninho Digital será um endosso
  discreto. O endereço planejado é `nosso.caderninho-digital.com`.
- A identidade herdada de Actual Budget é antiga e não deve limitar a nova
  identidade. Nenhuma direção visual foi aprovada até este ponto.

## Evidências disponíveis

- A implementação existente em `src/` demonstra os fluxos financeiros,
  variantes de largura e superfícies de IA em produção.
- `src/components/responsive/` registra a fronteira atual entre composições
  largas e estreitas.
- `src/components/ai/` contém as superfícies atuais de classificação,
  sugestões, auditoria e consultoria financeira.
- `../../docs/ai/` registra a arquitetura, o roadmap e as decisões de
  segurança, memória e análise financeira da IA.
- `public/screenshot_wide.png`, `public/screenshot_narrow.png` e os snapshots
  de E2E documentam o comportamento visual atual, mas não constituem uma nova
  identidade aprovada.
- Não há depoimentos, estudos de caso, benchmarks ou outras provas externas
  aprovadas que trabalhos futuros possam inventar ou apresentar como fatos.

## Princípios do produto

1. **Continuidade local primeiro.** O controle financeiro cotidiano deve
   sobreviver à ausência de internet e reconciliar-se quando a conexão voltar.
2. **Parceria como comportamento.** Web e mobile devem refletir as mesmas
   finanças, decisões e histórico do casal, ajudando os dois a participar sem
   presumir papéis idênticos.
3. **Paridade por resultado.** Cada contexto de tela deve permitir concluir o
   trabalho com qualidade, mesmo quando exigir fluxos ou componentes
   especializados.
4. **Resiliência à densidade.** Mais transações, categorias ou informações não
   podem transformar a interface em uma superfície quebrada ou sobreposta.
5. **IA como assistência.** A IA ajuda a classificar, compreender e planejar;
   as decisões financeiras continuam pertencendo à família.
