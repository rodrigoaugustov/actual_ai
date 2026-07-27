---
version: 1
slug: "ges-desktop-client-src-components-common-modal-tsx"
primary_target: "packages/desktop-client/src/components/common/Modal.tsx"
related_targets: ["packages/desktop-client/src/components/mobile/accounts/AccountScopeButton.tsx","packages/desktop-client/src/components/modals/CreateAccountModal.tsx","packages/desktop-client/src/components/modals/CreateLocalAccountModal.tsx","packages/desktop-client/src/components/modals/ConfirmTransactionEditModal.tsx","packages/desktop-client/src/components/modals/manager/ImportModal.tsx","packages/desktop-client/src/components/modals/manager/DeleteFileModal.tsx"]
---

# Sobreposições da casa

- **Scope · mode:** `packages/desktop-client/src/components/common/Modal.tsx`, Operate. Sistema transversal para tarefas temporárias, confirmações, menus e fluxos guiados.
- **Audience · job · task:** a família precisa concluir uma decisão sem perder o contexto da tela anterior; no mobile, campos e ações devem continuar alcançáveis com teclado e área segura.
- **Direction · memorable moment:** composição A aprovada, “Placa focada”. Na Web, uma placa branca compacta e central preserva o contexto; no mobile, tarefas curtas assentam como bottom sheet.
- **Hierarchy:** título e instrução ficam à esquerda, conteúdo ocupa uma coluna contínua e ações compartilham um trilho inferior estável. Fechar permanece explícito e tátil.
- **Responsive behavior:** abaixo do breakpoint pequeno, largura total, cantos apenas no topo e entrada vertical curta. Conteúdo longo pode crescer até quase toda a viewport e rolar internamente.
- **States:** carregamento bloqueia somente a placa; confirmação destrutiva usa Vermelho Limite apenas na consequência; modais empilhados recuam sem rotação.
- **Proof · constraints:** preservar foco, Escape, descarte externo, modais empilhados, larguras específicas e todos os fluxos existentes. Não adicionar vidro, gradiente, cards soltos ou identidade antiga.
- **Voice:** acolhedora e operacional; preferir conta, caderninho, casa e dispositivos quando o jargão técnico não for necessário.
- **Unresolved decisions:** fluxos realmente longos poderão evoluir para estágio de tela completa em marco posterior, sem alterar o padrão das tarefas curtas.
