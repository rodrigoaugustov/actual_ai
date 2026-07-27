---
name: Nosso Caderninho
description: As finanças da casa, cuidadas em conjunto.
colors:
  partnership: "#26677a"
  partnership-surface: "#26677a"
  partnership-soft: "#e4eff1"
  balance: "#4c7a61"
  balance-soft: "#e8f0eb"
  commitment: "#b96f00"
  commitment-soft: "#fff1db"
  limit: "#b44238"
  limit-soft: "#fbe9e7"
  enamel: "#f2f5f4"
  plate: "#ffffff"
  graphite: "#202729"
  graphite-subdued: "#5d6a6d"
  rail: "#b8c3c2"
  rail-soft: "#dfe6e4"
  signal-soft: "#edf2f1"
  nav: "#10292f"
  nav-hover: "#183a43"
  nav-text: "#f3f7f6"
  nav-text-subdued: "#b8c8c8"
  focus-on-light: "#26677a"
  focus-on-dark: "#58a7b8"
  dark-enamel: "#10292f"
  dark-plate: "#183a43"
  dark-graphite: "#f3f7f6"
  dark-graphite-subdued: "#b8c8c8"
  dark-partnership-surface: "#26677a"
  midnight-enamel: "#081c21"
  midnight-plate: "#10292f"
  midnight-partnership-surface: "#26677a"
typography:
  headline:
    fontFamily: "Aptos, Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 720
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Aptos, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.25
  body:
    fontFamily: "Aptos, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Aptos, Segoe UI, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
  financial:
    fontFamily: "Aptos, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
    fontFeature: "tnum"
rounded:
  control: "6px"
  panel: "10px"
  status: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  navigation-item:
    backgroundColor: "{colors.nav}"
    textColor: "{colors.nav-text-subdued}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  navigation-item-active:
    backgroundColor: "{colors.partnership}"
    textColor: "{colors.nav-text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  panel:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.panel}"
    padding: "{spacing.lg}"
  capacity-rail:
    backgroundColor: "{colors.signal-soft}"
    rounded: "{rounded.control}"
    height: "46px"
  button-ghost:
    backgroundColor: "{colors.partnership-soft}"
    textColor: "{colors.partnership}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  mobile-bottom-navigation:
    backgroundColor: "{colors.nav}"
    textColor: "{colors.nav-text}"
    height: "72px"
---

# Design System: Nosso Caderninho

## Overview

**Creative North Star: "Quadro da Casa"**

Nosso Caderninho se comporta como o quadro discreto que mantém uma casa funcionando: cada parte tem lugar, relação e estado reconhecíveis. Esmalte frio, placas brancas e trilhos funcionais formam uma interface precisa e doméstica, nunca corporativa ou decorativa.

A expressão vive na organização do trabalho. Relações financeiras aparecem em estruturas contínuas; números permanecem firmemente alinhados; a voz acolhedora lembra que duas pessoas cuidam da mesma casa. O sistema rejeita tanto o mosaico de cards de fintech quanto a imitação literal de um caderno de papel.

**Key Characteristics:**

- Estrutura operacional clara, densa e estável.
- Trilhos compartilhados como assinatura visual e relacional.
- Cor com função explícita, nunca como preenchimento arbitrário.
- Tipografia humanista de trabalho com números tabulares.
- Composições próprias para Web e mobile sobre a mesma realidade financeira.

## Colors

A paleta é fria, restrita e operacional: neutros ocupam a maior parte da superfície; cores aparecem em ações, relações e estados com significado.

### Primary

- **Azul Parceria:** identifica ações compartilhadas, seleção ativa e continuidade confiável.

### Secondary

- **Verde Equilíbrio:** sinaliza capacidade saudável, confirmação e resultado positivo.
- **Âmbar Compromisso:** identifica valores já comprometidos e decisões que aguardam revisão.
- **Vermelho Limite:** fica reservado a erro, risco real, saldo crítico e ação destrutiva.

### Neutral

- **Esmalte Claro:** campo principal frio e luminoso.
- **Placa Branca:** superfície de trabalho inserida sobre o campo.
- **Grafite Estrutural:** texto, ícones e estrutura de maior contraste.
- **Grafite Suave:** contexto, metadados e instruções secundárias.
- **Trilho Médio e Trilho Suave:** divisores e relações entre superfícies.
- **Sinal Suave:** seleção contextual e cabeçalhos de dados.
- **Navegação Profunda:** estrutura persistente da navegação Web e mobile.

**The Color Has a Job Rule.** Toda cor deve indicar ação, relação, estado ou agrupamento; se puder ser removida sem perda de significado, ela não é necessária.

**The Red Means Consequence Rule.** Vermelho não representa gasto comum por reflexo; aparece apenas quando há risco, erro ou consequência que exige atenção.

Os modos escuros preservam os mesmos papéis em vez de trocar a identidade por uma paleta genérica. No modo escuro, Navegação Profunda se torna o campo principal e Navegação Profunda Elevada vira a placa de trabalho. No modo meia-noite, esses campos recuam mais um passo, mantendo Grafite Claro e Azul Parceria Visível com contraste equivalente.

## Typography

**Display Font:** Aptos, com Segoe UI e system-ui como fallback.  
**Body Font:** Aptos, com Segoe UI e system-ui como fallback.  
**Financial Figures:** A mesma família com algarismos tabulares.

**Character:** aberta, direta e humana. A hierarquia usa poucos tamanhos e pesos intermediários para sobreviver a conteúdo denso sem perder contraste.

### Hierarchy

- **Headline** (720, 20px, 1.1): nomeia o estado atual da casa.
- **Title** (650, 17px, 1.25): organiza painéis e grupos de trabalho.
- **Body** (400, 13px, 1.45): carrega contexto, instruções e conteúdo.
- **Label** (600, 11px, 1.3): identifica controles e metadados em português natural.
- **Financial** (600, 13px, 1.3): alinha valores com algarismos tabulares.

**The Numbers Stay Put Rule.** Valores comparáveis mantêm largura, alinhamento e posição estáveis durante carregamento, edição e atualização.

**The Label Is Language Rule.** Rótulos devem ser lidos como português natural; caixa alta e tracking não servem de atalho para hierarquia.

## Layout

O sistema usa um shell persistente e um campo de conteúdo com largura máxima de 1480px. O ritmo base combina passos de 4, 8, 12, 16, 24 e 32px. Painéis relacionados compartilham bordas e alinhamentos em vez de se espalhar como cards independentes.

Na Web, o Painel Contínuo usa três colunas a partir de 1280px, duas colunas entre 900 e 1279px e uma coluna abaixo de 900px. No mobile, a partir de 729px para baixo, bordas laterais são removidas e a navegação fixa oferece cinco destinos: Hoje, Movimentos, Planejar, Assistente e Casa. Grades internas se adaptam à largura real do painel por container queries em 439px e 359px, não apenas à largura da janela.

Listas de visão geral são deliberadamente limitadas e apontam para registros completos; telas transacionais de alto volume devem usar virtualização, filtros persistentes e paginação sem deslocar contexto.

**The Density Is a Requirement Rule.** A composição é validada com a faixa máxima realista de conteúdo; estados vazios não provam resiliência.

**The Composition May Change Rule.** Web e mobile podem usar árvores e padrões especializados quando isso melhora clareza, alcance e desempenho.

## Elevation & Depth

O sistema não usa sombras em superfícies em repouso. Profundidade vem de campos tonais, trilhos, bordas e encaixe entre placas. Sombras ficam restritas a sobreposições reais como diálogos, menus, objetos em arraste e superfícies temporárias.

**The Panel Is Not a Card Rule.** Conteúdo relacionado compartilha estrutura e alinhamento antes de receber um contêiner individual.

**The Overlay Must Be Real Rule.** Se um elemento não bloqueia, flutua ou se move sobre outro, ele não ganha sombra para parecer importante.

## Shapes

Controles usam cantos táteis de 6px; placas isoladas podem usar 10px; bordas totalmente arredondadas ficam restritas a estados compactos. Trilhos e divisões permanecem retos e contínuos. Bordas têm 1px e nunca funcionam como faixa colorida decorativa.

**The Shared Edge Rule.** Elementos relacionados preferem bordas compartilhadas, alinhamento e continuidade a espaços decorativos entre caixas.

## Components

### Buttons

- **Shape:** cantos compactos de controle.
- **Ghost:** Azul Parceria sobre Azul Parceria Suave; o hover troca o campo tonal em 180ms.
- **Focus:** anel externo de 2px; Azul Parceria em superfícies claras e Foco Visível em superfícies profundas, sempre com pelo menos 3:1 contra o entorno.

### Cards / Containers

- **Panels:** Placa Branca, borda de trilho de 1px, sem sombra.
- **Headers:** 16px de padding, título de 17px e descrição de 13px.
- **Relationship:** painéis adjacentes compartilham uma borda.

### Navigation

- **Web:** fundo de Navegação Profunda, itens de 36–40px e seleção em Azul Parceria sem faixa lateral.
- **Mobile:** barra fixa de 72px com exatamente cinco destinos; Casa abre uma placa sobreposta com Análises e organização.
- **States:** hover usa Navegação Profunda elevada; focus usa anel de 2px.

### Capacity Rail

O trilho de 46px é a assinatura do sistema. Âmbar mostra o comprometido, Azul Parceria mostra o planejado e Verde Equilíbrio mostra o ainda disponível. Valores e legenda permanecem visíveis mesmo quando um segmento tende a zero.

### Dense Rows

Linhas usam divisores de 1px, texto truncado com elipse e colunas numéricas alinhadas à direita. No mobile, metadados podem mudar de linha ou uma coluna secundária pode ser suprimida, mas valor e ação sobrevivem.

## Do's and Don'ts

### Do:

- **Do** use trilhos e alinhamentos para tornar relações financeiras visíveis.
- **Do** mantenha valores tabulares, ações importantes e contexto estáveis.
- **Do** trate offline e reconexão como estados compreensíveis.
- **Do** adapte composição e densidade à largura e ao modo de interação.
- **Do** combine cor com texto, ícone ou forma.

### Don't:

- **Don't** reconstrua a experiência como um mosaico de cards de KPI.
- **Don't** use papel creme, linhas de caderno ou skeuomorfismo literal.
- **Don't** use sombra, gradiente ou vidro para substituir hierarquia.
- **Don't** esconda valores e ações críticos por sobreposição ou rolagem horizontal acidental.
- **Don't** obrigue o mobile a reproduzir a composição da Web.
