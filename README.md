<p align="center">
  <img src="/packages/desktop-client/public/screenshot_wide.png" alt="Nosso Caderninho" />
</p>

<h1 align="center">Nosso Caderninho</h1>

<p align="center"><strong>As finanças da casa, cuidadas em conjunto.</strong></p>

Nosso Caderninho é um gestor financeiro familiar feito para casais
administrarem, entenderem e planejarem juntos a vida financeira — com
continuidade entre o computador e o celular, e sem depender de conexão
permanente.

A ideia é a de um caderninho compartilhado: uma memória financeira da casa, em
que os dois enxergam a mesma realidade, com um assistente de IA ajudando a
classificar e a planejar. As decisões continuam sendo da família.

## Para quem é

Para um casal que cuida das mesmas finanças em telas diferentes — um usa mais a
Web, a outra usa só o celular. Ambas as superfícies precisam permitir concluir o
trabalho de verdade, mesmo que a composição visual não seja idêntica.

Hoje uma única família usa e valida o produto. Ele é deliberadamente específico
em vez de genérico.

## O que ele faz

- **Orçamento e controle cotidiano** — contas, transações, categorias e
  orçamento por envelopes.
- **Assistência de IA** — classificação de despesas, revisão de sugestões,
  mineração de regras, auditoria de uso e um consultor financeiro para
  planejamento. A arquitetura e as decisões estão em [`docs/ai/`](docs/ai/).
- **Local-first de verdade** — o orçamento vive num SQLite dentro do navegador.
  Continua funcionando offline e sincroniza quando a conexão volta.
- **Web e mobile** — um produto React responsivo, empacotado também para desktop
  (Electron) e mobile (Capacitor).

<p align="center">
  <img src="/packages/desktop-client/public/screenshot_narrow.png" alt="Nosso Caderninho no celular" width="320" />
</p>

## Rodando em produção

O deploy é pessoal — acesso do celular e de outros computadores, não aberto ao
público. A imagem multi-arquitetura é publicada no GHCR a cada push em `master`:

```
ghcr.io/rodrigoaugustov/actual-ai:master
```

O runbook completo — provisionamento, atualização, backup, restauração e
rollback — está em **[`deploy/README.md`](deploy/README.md)**.

Para subir uma instância local equivalente à de produção:

```bash
docker compose -f packages/sync-server/docker-compose.yml up --detach --build
```

A aplicação fica em `http://localhost:5006`.

## Desenvolvimento

Requer Node.js >= 22 e Yarn 4.

```bash
corepack yarn install
corepack yarn start        # dev server em http://localhost:3001
corepack yarn typecheck
corepack yarn test
corepack yarn lint:fix
```

No Windows o `yarn start` padrão não funciona e o loop de iteração rápida é
outro. Isso, junto das convenções de código, testes e commits, está em
**[`AGENTS.md`](AGENTS.md)** — leia antes de contribuir ou de apontar um agente
para este repositório.

### Estrutura

| Pacote              | Papel                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| `loot-core`         | lógica central, roda em qualquer plataforma (inclusive no web worker) |
| `desktop-client`    | a interface React (Web e mobile)                                      |
| `desktop-electron`  | empacotamento desktop                                                 |
| `sync-server`       | servidor de sincronização e proxy das chaves de IA                    |
| `component-library` | componentes e tokens de design compartilhados                         |
| `crdt`              | sincronização sem conflito entre dispositivos                         |

A intenção de produto e de design está em
[`packages/desktop-client/PRODUCT.md`](packages/desktop-client/PRODUCT.md) e
[`DESIGN.md`](packages/desktop-client/DESIGN.md).

## Origem e licença

Este projeto começou como um fork do
[Actual Budget](https://github.com/actualbudget/actual) e desde então seguiu
caminho próprio — produto, design, identidade e ciclo de release são deste
repositório, não do projeto original.

Licenciado sob MIT, preservando o copyright original conforme
[`LICENSE.txt`](LICENSE.txt).
