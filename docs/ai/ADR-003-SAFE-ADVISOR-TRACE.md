# ADR-003 — Rastro seguro de execução do consultor

Data: 2026-07-24

Status: aceito

## Contexto

Durante uma consulta longa, o usuário precisa entender se o consultor está
recuperando contexto, analisando dados, validando cobertura ou corrigindo uma
consulta. Ao final, também é útil poder auditar como a resposta foi construída.

Expor o raciocínio interno bruto do modelo não é um contrato seguro nem estável.
Esse conteúdo pode conter instruções internas, hipóteses descartadas, dados
sensíveis, argumentos integrais de tools e detalhes de implementação que não
constituem evidência confiável da resposta.

## Decisão

O produto expõe um **rastro operacional semântico**, gerado pelo harness, e não
o chain-of-thought do modelo.

O harness publica eventos tipados para:

- compreensão da solicitação;
- recuperação de contexto confirmado;
- planejamento e refinamento da análise;
- execução de tools;
- validação de cobertura;
- reparo ou nova tentativa;
- composição da resposta.

Cada evento possui identidade, estado, início, fim e metadados estruturais
allowlisted. A interface mantém o rastro expandido durante a execução, recolhe
automaticamente após a resposta e permite reabertura posterior. O mesmo rastro
é persistido junto à mensagem para continuar auditável em outra sessão.

## Contrato de segurança

O rastro pode mostrar nomes amigáveis de tools, datasets semânticos, períodos,
campos, dimensões, métricas, operadores, contagens, cobertura, tentativas e
duração.

O rastro nunca mostra:

- chain-of-thought ou texto privado de raciocínio do provider;
- system prompt ou instruções internas;
- SQL, AQL ou consultas livres;
- argumentos ou resultados integrais de tools;
- valores de filtros, identificadores de contas ou transações;
- conteúdo de memórias, documentos ou evidências financeiras;
- chaves, tokens ou credenciais.

A sanitização ocorre no core antes da persistência e antes do evento chegar à
interface. A UI não transforma payload bruto em conteúdo visível.

## Consequências

- O usuário acompanha progresso real e pode auditar a sequência operacional.
- O rastro é consistente entre providers e não depende de suporte proprietário
  a reasoning tokens.
- Novas etapas precisam de um tipo semântico e uma política explícita de
  sanitização.
- O rastro explica o processo e as fontes, mas não substitui as evidências e
  premissas da resposta final.
