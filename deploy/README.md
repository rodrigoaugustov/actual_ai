# Runbook — actual_ai em produção

Deploy pessoal deste fork: acesso pelo celular e por outros computadores, não
aberto ao público.

## O que roda onde

O app é **local-first**, e isso muda o que "produção" significa aqui. Todo o
orçamento vive num SQLite **dentro do navegador**, e toda a orquestração de IA
(classifier, rule-miner, auditor, advisor) roda no web worker do cliente — não no
servidor. É a decisão D2 em [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md).

O sync-server só faz quatro coisas: serve os arquivos estáticos, guarda blobs
CRDT (sem entender o conteúdo), guarda as chaves de API e faz proxy das chamadas
de LLM, e conversa com Pluggy/GoCardless. Não há migração server-side, cron, fila
ou worker.

Consequência prática: **os jobs de IA só rodam com o app aberto**. O servidor não
categoriza nada às 3h da manhã.

```
GitHub Actions (arm64 + amd64)  ──push──►  ghcr.io/rodrigoaugustov/actual-ai
                                                     │  (manifest multi-arch)
                                     systemd timer ──┘ pull a cada 5 min
                                                     ▼
GCP e2-micro OU Oracle Ampere A1 ── docker network (nenhuma porta publicada)
                      actual:5006  ◄──  cloudflared ──► Cloudflare edge
                      /srv/actual/data                        │
                                          https://financas.caderninho-digital.com
```

O host em uso hoje é o **GCP e2-micro** (ver `deploy/provision-gcp.sh`); a
Oracle segue como alternativa documentada. O `:master` no GHCR é um manifest
multi-arch — o Docker do host resolve sozinho qual imagem baixar.

---

## Setup inicial

Passo a passo completo (incluindo escolha de host, GCP ou Oracle) está em
[`docs/DEPLOY.md`](../docs/DEPLOY.md). Resumo abaixo — para reexecutar ou
recriar do zero, prefira o guia completo, que evolui com mais frequência.

### 1. Instância

Não é preciso mexer em Security List nem em `iptables` em nenhum dos dois
provedores: o `cloudflared` só abre conexão de saída. Essa é a principal razão
de ter escolhido tunnel em vez de um reverse proxy com portas abertas.

- **GCP:** `deploy/provision-gcp.sh` — `e2-micro`, Ubuntu 24.04 amd64, disco
  `pd-standard` 30 GB (limite exato do Always Free).
- **Oracle:** `deploy/provision-oracle.sh` — `VM.Standard.A1.Flex`, Ubuntu
  24.04 arm64, 2 OCPU / 12 GB, boot volume 100 GB. As regras de `iptables` que
  as imagens Ubuntu da Oracle trazem sobrevivem a um `ufw allow` e são a forma
  mais comum de esse caminho falhar — mas como nada precisa de porta de
  entrada, isso é irrelevante aqui.

### 2. Cloudflare Tunnel

No dashboard: **Zero Trust → Networks → Tunnels → Create a tunnel**.

- Public hostname: `financas.caderninho-digital.com`
- Service: `HTTP` → `actual:5006` (nome do serviço no compose, não `localhost`)
- Copie o token para `TUNNEL_TOKEN` no `.env`

Depois, **no hostname**, desligue **Rocket Loader, Auto Minify e Email
Obfuscation**. Os três injetam script inline, e o CSP de produção não tem
`unsafe-inline` — o app quebra na hora. SSL mode: `Full`.

### 3. Backup: R2 + age

```bash
# Chave de criptografia — gere na SUA máquina, não no servidor
age-keygen -o actual-backup-key.txt
```

Guarde `actual-backup-key.txt` no gerenciador de senhas. **Só a chave pública vai
para o servidor** (`AGE_RECIPIENT` no `.env`): assim o host consegue escrever
backups mas não consegue ler os antigos.

No Cloudflare R2, crie o bucket e um API token, e configure o rclone no servidor:

```bash
rclone config create r2 s3 provider=Cloudflare \
  access_key_id=<KEY> secret_access_key=<SECRET> \
  endpoint=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

### 4. Bootstrap

```bash
git clone https://github.com/rodrigoaugustov/actual_ai.git /srv/actual/repo
cd /srv/actual/repo/deploy
cp .env.example .env && chmod 600 .env
# preencha o .env
sudo ./bootstrap.sh
```

### 5. Primeiro acesso

Abra `https://financas.caderninho-digital.com`, crie o usuário admin e faça login.

Depois, **em Settings**, cole a chave da Anthropic e as credenciais Pluggy. Elas
**não são variáveis de ambiente** — vivem na tabela `secrets` de
`/data/server-files/account.sqlite`, gravadas via `POST /secret`. Uma instância
nova sobe com IA não-funcional até esse passo.

### 6. Monitor

UptimeRobot (free) em `https://financas.caderninho-digital.com/health`, a cada
5 min. Se o host for Oracle, o tráfego também evita reciclagem de instâncias
Always Free ociosas — no GCP isso não se aplica, o e2-micro não é recuperado
por inatividade.

---

## Operação

### Deploy

O fluxo completo, do código até o celular:

1. **Altere e valide localmente** — `yarn lint:fix` + `yarn typecheck` no
   mínimo (guardrails do [`AGENTS.md`](../AGENTS.md)); testes escopados ao que
   mudou, se for lógica.
2. **Commit + push no `master`.** Este fork não usa PR para o dia a dia — vai
   direto.
3. **CI builda e publica** (`fork-ci.yml` + `fork-image.yml`): lint/typecheck/
   teste, depois a imagem multi-arch (`amd64` + `arm64`, nativamente, um
   runner de cada), com boot test antes do push — uma imagem quebrada nunca
   chega ao GHCR. Tempo observado: **CI ~1–2 min, build+publish ~6–10 min**
   (o menor tempo é com o cache do GitHub Actions já quente).
4. **O host pega em até 5 minutos** (timer do systemd). `update.sh` tira um
   backup pré-deploy — **se o backup falhar, o deploy é abortado**, de
   propósito, para nunca aplicar uma versão nova sem rede de segurança — sobe
   a versão nova e verifica `/health`. Se não ficar saudável em 120s, volta
   sozinho para a anterior.

Do push ao ar, contando o pior caso: **~15–20 minutos**, sem você precisar
fazer nada depois do passo 2.

```bash
systemctl status actual-update.timer     # quando foi a última checagem
journalctl -u actual-update -n 50        # log do último deploy
./update.sh                              # forçar agora, sem esperar o timer
docker compose -f compose.prod.yml --env-file .env ps
./verify.sh                              # confirma que a versão nova está no ar e saudável
```

As versões próprias deste fork começam em `1.0.0` e ficam no campo
`actualAiVersion` de `packages/desktop-client/package.json` e
`packages/sync-server/package.json`. Cada imagem também recebe o commit do
build; por isso Configurações mostra, por exemplo, `v1.0.0 (e8010db)`.

Para consultar manualmente o que está rodando, os deploys desta VM e os builds
recentes do workflow de imagem:

```bash
cd /srv/actual/repo
git pull --ff-only                       # traz versões novas dos scripts de operação
cd deploy
./history.sh                             # últimos 20
./history.sh 50                          # últimos 50
```

O histórico do GitHub é público e não precisa de token. Se o repositório ou o
package forem tornados privados, exporte `GITHUB_TOKEN` com acesso de leitura
antes de rodar o script.

**Aviso no celular via ntfy.sh é opcional e está desligado nesta instância**
(`NTFY_TOPIC` vazio no `.env`) — sem ele, `update.sh` só registra no
`journalctl`, não empurra nada para o telefone. Para ligar, escolha um tópico
difícil de adivinhar (tópicos do ntfy.sh são públicos para quem sabe o nome) e
preencha `NTFY_TOPIC`/`NTFY_SERVER` no `.env`; nenhum outro passo é
necessário, `lib.sh` já lê essas variáveis.

**Se a mudança tocar `packages/loot-core` ou `packages/desktop-client/public/data/migrations/`:**
migração de cliente roda no SQLite do **navegador**, não no boot do servidor,
e o service worker é `registerType: 'prompt'` — aceite o prompt de atualização
em todos os dispositivos antes de abrir o orçamento (ver "Quando quebrar"
abaixo). Mudança só em `sync-server` não tem esse cuidado.

### Rollback

```bash
./rollback.sh                                    # volta para .last-good
./rollback.sh ghcr.io/rodrigoaugustov/actual-ai@sha256:...   # versão específica
```

Um digest que falhou no health check fica em `.blocked` e **não é reinstalado**
até um build novo aparecer. Sem isso o timer reinstalaria a imagem quebrada a
cada 5 minutos, em loop.

> `rollback.sh` volta **só o código**. Se a versão ruim carregava migração de
> cliente e você já abriu o orçamento em algum dispositivo, o arquivo de
> orçamento já avançou — aí precisa de `restore.sh` também.

### Backup

```bash
./backup.sh                  # manual, fora do timer
./restore.sh --list          # o que existe no R2
journalctl -u actual-backup -n 30
```

Retenção: 14 diários, 8 semanais, 5 pré-deploy.

### Restauração

Faça o **ensaio** pelo menos uma vez — backup nunca restaurado é palpite:

```bash
AGE_IDENTITY=/caminho/actual-backup-key.txt \
  ./restore.sh actual-2026....tar.age --into /tmp/drill
```

Restauração real (para o servidor, sobrescreve os dados vivos):

```bash
AGE_IDENTITY=/caminho/actual-backup-key.txt \
  ./restore.sh actual-2026....tar.age --into /srv/actual/data --force
```

---

## Quando quebrar

**Tela de erro sobre `SharedArrayBuffer`.** O app precisa de cross-origin
isolation. Confira que os headers chegam **sem duplicação**:

```bash
curl -sI https://financas.caderninho-digital.com | grep -i cross-origin
```

Tem que aparecer exatamente um `Cross-Origin-Opener-Policy: same-origin` e um
`Cross-Origin-Embedder-Policy: require-corp`. Duplicado (`require-corp,
require-corp`) é rejeitado pelo browser — é o modo de falha clássico de reverse
proxy aqui, causado por `add_header` do nginx, que concatena em vez de
substituir. O Caddy e o cloudflared repassam intactos.

**Página em branco ou erro de CSP.** Quase sempre é Rocket Loader / Auto Minify
ligado na Cloudflare.

**`denied` ao puxar a imagem.** Pacotes no GHCR nascem privados mesmo em repo
público. Marque o package como público no GitHub, ou preencha `GHCR_USER` e
`GHCR_TOKEN` (escopo `read:packages`) no `.env` e rode o bootstrap de novo.

**App reclamando de versão depois de um deploy.** As 10 migrações do fork rodam
no SQLite do **navegador** ao abrir o orçamento, não no boot do servidor. O
service worker é `registerType: 'prompt'`. Depois de um deploy que carregue
migração, **aceite o prompt de atualização em todos os dispositivos antes de
abrir o orçamento** — um PWA em cache antigo bate em incompatibilidade.

**Chat do advisor cortando no meio.** O plano free da Cloudflare corta em 100s
sem resposta. Vale só até o primeiro byte, e o advisor faz streaming progressivo,
então na prática passa — mas se aparecer erro 524, é isso.

---

## Riscos conhecidos

1. **Custo de IA sem teto no servidor.** O hook pós-sync é fire-and-forget e
   processa até 500 transações em lotes de 50 — até 10 chamadas por conta por
   sync, mais o auditor. `maxCostPerDayUsd` tem default de US$ 1, mas é aplicado
   **só no cliente**; o proxy não impõe orçamento nenhum. Acompanhe pela
   telemetria em Settings.
2. **SSRF autenticado.** `ai_ollama_baseUrl` não passa por allowlist — qualquer
   usuário logado pode apontar o servidor para um host arbitrário. Por isso
   `ACTUAL_USER_CREATION_MODE=manual`: não crie usuários extras.
3. **CORS permissivo.** `app.use(cors())` responde `Access-Control-Allow-Origin: *`
   em todas as rotas. A autenticação por token ainda protege.
4. **Segredos em texto claro.** A tabela `secrets` do `account.sqlite` guarda a
   chave da Anthropic e as credenciais Pluggy sem criptografia. É por isso que o
   backup é cifrado antes de sair do host.
5. **Reciclagem da Oracle** (só se esse for o host escolhido). Instâncias
   Always Free ociosas podem ser recuperadas pela Oracle; o monitor do passo 6
   mitiga. Não se aplica ao e2-micro do GCP.
