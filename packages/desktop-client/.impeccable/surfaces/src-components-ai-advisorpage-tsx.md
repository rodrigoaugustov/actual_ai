---
version: 1
slug: "src-components-ai-advisorpage-tsx"
primary_target: "src/components/ai/AdvisorPage.tsx"
related_targets: ["src/components/ai/AdvisorMessage.tsx","src/components/ai/AdvisorTrace.tsx"]
---

# Assistente — conversa em foco

- **Scope · mode:** `src/components/ai/AdvisorPage.tsx`, Operate. Redesign completo da experiência responsiva do Assistente, preservando todas as capacidades atuais.
- **Audience · job · task:** a família conversa com o Assistente para compreender a situação financeira, avaliar decisões e transformar recomendações em planos confirmados. A conversa é a tarefa principal; histórico, memória, objetivos, documentos e planos são apoio.
- **Proof · constraints:** respostas sustentadas por evidências financeiras e contexto confirmado; dados financeiros somente leitura; memória e planos exigem confirmação. O conteúdo canônico permanece local-first, mas gerar ou cancelar respostas requer conexão.
- **Direction · memorable moment:** “conversa com contexto visível, não contexto concorrente”. Uma conversa ampla ocupa a superfície; uma faixa discreta resume o contexto, enquanto histórico e configurações abrem em gavetas responsivas. Evidências, rastreamento seguro e propostas aparecem inline.
- **Responsive behavior:** desktop e web estreita usam a mesma hierarquia com composições adequadas; no mobile, conversa em tela cheia e gavetas como folhas/páginas. Nenhuma navegação horizontal por abas, painel de indicadores ou inspetor de contexto permanente.
- **States:** vazio orientado, carregamento, streaming, cancelamento, erro recuperável, histórico longo, evidência larga e offline com leitura/rascunho preservados, envio desabilitado e sem fila automática.
- **Unresolved decisions:** nenhuma decisão de produto aberta; textos e contagens da prévia visual são ilustrativos e devem derivar dos dados existentes.
