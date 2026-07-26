---
version: 1
slug: "src-components-budget-index-tsx"
primary_target: "src/components/budget/index.tsx"
related_targets: ["src/components/mobile/budget/BudgetPage.tsx"]
---

# Planejamento — Mesa de Acordos

- Escopo: rota `/budget`, composições Web e mobile.
- Modo: Operate.
- Público: casal administrando a mesma casa, com uso frequente na Web e exclusivo no mobile.
- Trabalho principal: escolher o mês, distribuir recursos, comparar planejado e usado, localizar excessos reais e ajustar categorias sem perder o contexto mensal.
- Conteúdo obrigatório: navegação mensal por setas, capacidade disponível, totais, grupos e categorias, edição de valores, metas/modelos, notas, atividade, categorias ocultas, criação/reordenação e variantes envelope/tracking.
- Restrições: dezenas de categorias, valores longos, funcionamento local-first, nenhuma rolagem horizontal acidental e vermelho apenas para consequência real.
- Direção aprovada: composição A+C — registro contínuo da opção A com trilho proporcional de capacidade da opção C.
- Momento memorável: o trilho da casa torna visível a relação Planejado → Comprometido → Disponível e permanece ligado ao registro abaixo.
- Adaptação mobile: grupos contínuos e linhas táteis próprias; não reduzir a tabela Web.
- Decisões em aberto: nenhuma para este marco.
