---
version: 1
slug: "op-client-src-components-manager-welcomescreen-tsx"
primary_target: "packages/desktop-client/src/components/manager/WelcomeScreen.tsx"
related_targets: ["packages/desktop-client/src/components/AppBackground.tsx","packages/desktop-client/src/components/manager/BudgetFileSelection.tsx","packages/desktop-client/src/components/manager/ConfigServer.tsx","packages/desktop-client/src/components/manager/ManagementApp.tsx","packages/desktop-client/src/components/manager/ManagerSurface.tsx","packages/desktop-client/src/components/manager/ServerURL.tsx","packages/desktop-client/src/components/manager/subscribe/Bootstrap.tsx","packages/desktop-client/src/components/manager/subscribe/common.tsx","packages/desktop-client/src/components/manager/subscribe/ConfirmPasswordForm.tsx","packages/desktop-client/src/components/manager/subscribe/Login.tsx","packages/desktop-client/src/components/manager/subscribe/OpenIdForm.tsx"]
---

# Entrada da casa

- **Scope · mode:** `packages/desktop-client/src/components/manager/WelcomeScreen.tsx`, Operate. Redesign contínuo da primeira abertura, conexão e seleção de orçamento.
- **Audience · job · task:** uma família precisa chegar à sua situação financeira real sem aprender jargão técnico. Usuários recorrentes abrem um caderninho existente; novos usuários podem criar, experimentar ou importar.
- **Aha moment:** abrir a visão real da casa — ou um exemplo funcional — em menos de um minuto.
- **Proof · constraints:** preservar criação local, demo, importação, configuração opcional de servidor, abertura e download de arquivos, estados offline, criptografia, compartilhamento, atualização, duplicação e exclusão. Não inventar contas, membros, permissões ou garantias.
- **Direction · memorable moment:** composição A aprovada, “A casa primeiro”. Uma placa de identidade apresenta a promessa compartilhada e uma placa operacional separa entrar na casa existente de começar um novo caderninho. Demo e importação permanecem secundárias.
- **Information architecture:** primeira abertura oferece Entrar na nossa casa, Começar um novo caderninho, Experimentar com exemplo e Importar orçamento. O retorno apresenta os caderninhos disponíveis e suas condições local/sincronizada/offline.
- **Responsive behavior:** tela ampla usa duas placas conectadas; mobile transforma a identidade em cabeçalho compacto e empilha as ações em ordem de prioridade. O seletor usa linhas densas resilientes, nunca cards soltos ou rolagem horizontal.
- **States:** sem arquivos, arquivos locais, remotos, sincronizados, desconhecidos offline, criptografados com ou sem chave, lista vazia após filtro, criação em andamento, carregamento de conexão e quick switch.
- **Voice:** acolhedora, prática e colaborativa. Preferir “casa”, “caderninho” e “orçamento”; evitar “arquivo” e “servidor” na primeira camada quando a precisão técnica não for necessária.
- **Unresolved decisions:** nenhuma decisão estrutural aberta. A composição A é contrato; copy pode ser refinada durante validação sem alterar a hierarquia aprovada.
