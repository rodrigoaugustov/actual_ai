---
version: 1
slug: 'src-components-settings-index-tsx'
primary_target: 'src/components/settings/index.tsx'
related_targets:
  ['src/components/settings/UI.tsx', 'src/components/settings/AiSettings.tsx']
---

# Organização — planta operacional da casa

- **Scope · mode:** `src/components/settings/index.tsx`, Operate. Redesign da entrada de Organização e Configurações, preservando todos os controles e comportamentos existentes.
- **Audience · job · task:** a família precisa encontrar e alterar preferências, conexão, segurança, IA e cuidados com os dados sem percorrer uma coluna única e interminável. A troca de orçamento continua disponível como ação secundária de baixa frequência.
- **Proof · constraints:** configurações e estados vêm exclusivamente dos hooks e componentes atuais. O produto financeiro básico permanece local-first; o Assistente explicita sua dependência de conexão. Nenhuma capacidade nova de membros, permissões ou histórico será sugerida.
- **Direction · memorable moment:** composição C aprovada, “planta em duas escalas”. No desktop, mapa lateral persistente da casa + palco dedicado ao capítulo ativo. No mobile, o mapa vira uma entrada de capítulos e cada capítulo abre em tela focada com retorno explícito.
- **Information architecture:** Casa e orçamento; Aparência e formatos; Conexão e segurança; Assistente; Dados e manutenção. Sobre/versões e ferramentas avançadas pertencem a Dados e manutenção.
- **Responsive behavior:** desktop mantém contexto e capítulo lado a lado com colunas `minmax(0, 1fr)`; mobile nunca comprime as duas escalas, mostra mapa ou capítulo e preserva espaço para a navegação fixa de 72px.
- **States:** orçamento local ou sincronizado, recursos condicionados por feature flag e Electron, carregamento/erro de IA, capítulo vazio por condição, ferramentas avançadas recolhidas e conteúdo longo/denso.
- **Unresolved decisions:** nenhuma decisão de produto aberta. Valores e textos ilustrativos do comp não são contrato; somente capacidades existentes entram na implementação.
