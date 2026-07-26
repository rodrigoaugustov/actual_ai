---
version: 1
slug: 'src-components-reports-overview-tsx'
primary_target: 'src/components/reports/Overview.tsx'
related_targets:
  [
    'src/components/reports/ReportCard.tsx',
    'src/components/reports/DashboardHeader.tsx',
    'src/components/reports/DashboardSelector.tsx',
  ]
---

# Análises — oficina de leitura comparativa

- **Scope · mode:** `src/components/reports/Overview.tsx`, Operate. Redesign da entrada de Análises, preservando dashboards, widgets, relatórios detalhados e customização.
- **Audience · job · task:** a família precisa entender o que mudou, comparar períodos e aprofundar uma pergunta sem atravessar um mosaico de indicadores. A visão geral abre o trabalho; a oficina mantém uma análise ativa em escala real.
- **Proof · constraints:** gráficos, valores e comparações derivam dos dados locais existentes. Todos os controles da Web precisam de um caminho mobile adaptado. Volumes densos devem manter valores alinhados e ações alcançáveis.
- **Direction · memorable moment:** arquitetura de razão comparativa da composição B, com a visão geral equilibrada da composição A. Navegador vertical no desktop, folha/página no mobile, resumo em trilho compartilhado e widgets encaixados como uma superfície contínua, nunca cards de KPI.
- **Responsive behavior:** desktop usa navegador de análises + bancada; mobile mostra uma análise por vez, abre biblioteca e organização em folhas e mantém o conteúdo acima da navegação fixa de 72px.
- **States:** carregamento local, painel vazio, widgets densos, edição, importação, falha de widget, múltiplas visões, recursos condicionados por feature flag e listas longas.
- **Unresolved decisions:** nenhuma decisão de produto aberta. Os textos narrativos e números ilustrativos dos comps não devem ser inventados quando não existirem nos dados atuais.
