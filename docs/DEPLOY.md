# Guia de deploy — do zero ao app no celular

Passo a passo completo. Cada estágio diz o que é **automatizado** (script que
você roda e reusa) e o que é **manual** (não existe API, ou envolve credencial
que só você deve digitar).

Referência de operação do dia a dia: [`deploy/README.md`](../deploy/README.md).

## Panorama

| #   | Estágio                         | Como                  | Tempo         |
| --- | ------------------------------- | --------------------- | ------------- |
| 1   | Validar o build na CI           | automático (push)     | ~20 min       |
| 2   | Publicar a imagem no GHCR       | automático + 1 clique | 2 min         |
| 3   | Ferramentas locais              | script                | 10 min        |
| 4   | Credenciais Oracle e Cloudflare | **manual**            | 15 min        |
| 5   | Provisionar a VM Oracle         | script (com retry)    | 5 min a horas |
| 6   | Provisionar Cloudflare          | script                | 1 min         |
| 7   | Chaves do R2 e backup           | **manual** + script   | 10 min        |
| 8   | Subir a stack no host           | script                | 10 min        |
| 9   | Primeiro login e segredos       | **manual**            | 5 min         |
| 10  | Verificação e monitor           | script + **manual**   | 10 min        |

O estágio 5 pode demorar: capacidade Always Free A1 vive esgotada. O script
tenta em loop em todos os domínios de disponibilidade — deixe rodando.

---

## 1. Validar o build na CI

Nada mais importa até a imagem construir. Este é o estágio que prova a correção
do bug de maiúsculas em `component-library` — ele **não é verificável no
Windows**, porque o filesystem local funde `src/Themes/` e `src/themes/`.

```bash
git push origin master
```

Acompanhe:

```bash
gh run watch
```

Dois workflows disparam: `CI` (lint, typecheck, testes) e `Image` (build arm64
nativo, teste de boot, push para o GHCR). Se o `Image` falhar em
`yarn build:browser` com erro de import de tema, a correção da Fase 0 não pegou.

## 2. Publicar a imagem no GHCR

Depois do primeiro `Image` verde, o pacote existe mas nasce **privado**, mesmo
em repositório público — e não há endpoint REST para mudar isso.

**Manual:** `github.com/rodrigoaugustov?tab=packages` → `actual-ai` → _Package
settings_ → _Change visibility_ → **Public**.

Alternativa, se preferir manter privado: crie um PAT com escopo `read:packages`
e preencha `GHCR_USER`/`GHCR_TOKEN` no `.env` do servidor (estágio 8).

Confirme:

```bash
docker manifest inspect ghcr.io/rodrigoaugustov/actual-ai:master
```

## 3. Ferramentas locais

Você já tem `gh`, `docker`, `node` e `ssh`. Faltam `oci`, `jq`, `age` e uma
chave SSH.

```bash
winget install --id Oracle.OCICLI --accept-package-agreements
winget install --id jqlang.jq --accept-package-agreements
winget install --id FiloSottile.age --accept-package-agreements
```

`rclone` só é necessário no servidor, e o `bootstrap.sh` o instala lá.

Chave SSH para a VM (se ainda não tiver):

```bash
ssh-keygen -t ed25519 -C actual-ai
```

Os scripts de provisionamento são bash — rode-os no **Git Bash**, não no
PowerShell.

## 4. Credenciais (manual)

### Oracle

```bash
oci setup config
```

Ele gera um par de chaves e pergunta tenancy OCID, user OCID e região — todos
em _Profile → Tenancy / User settings_ no console. Ao final ele imprime o
caminho da **chave pública**; cole o conteúdo em _User settings → API keys →
Add API key → Paste public key_.

Teste:

```bash
oci iam region list --output table
```

### Cloudflare

Crie um token em _My Profile → API Tokens → Create Token → Custom token_ com:

| Escopo  | Permissão                 | Recurso                  |
| ------- | ------------------------- | ------------------------ |
| Account | `Cloudflare Tunnel:Edit`  | sua conta                |
| Account | `Workers R2 Storage:Edit` | sua conta                |
| Zone    | `Zone:Read`               | `caderninho-digital.com` |
| Zone    | `DNS:Edit`                | `caderninho-digital.com` |
| Zone    | `Zone Settings:Edit`      | `caderninho-digital.com` |

Guarde no gerenciador de senhas.

## 5. Provisionar a VM Oracle

```bash
cd deploy
./provision-oracle.sh
```

Cria VCN, gateway, rotas, security list (só SSH de entrada — o app não precisa
de porta nenhuma, o cloudflared disca para fora) e a instância
`VM.Standard.A1.Flex` 2 OCPU / 12 GB / 100 GB com Ubuntu 24.04 arm64.

Se aparecer `no capacity` repetidamente, é normal: o script continua tentando
em cada domínio de disponibilidade. Anote o **IP público** que ele imprime.

## 6. Provisionar Cloudflare

```bash
CF_API_TOKEN=<seu-token> ./provision-cloudflare.sh
```

Cria o tunnel, aponta o ingress para `http://actual:5006`, cria o CNAME
proxied, **desliga Rocket Loader / minify / email obfuscation** (os três
injetam script inline e o CSP de produção não tem `unsafe-inline` — é a forma
mais comum de quebrar o app pelo lado da Cloudflare) e cria o bucket R2.

Escreve o token do tunnel em `deploy/.env.generated`. É credencial: mova para o
servidor e apague a cópia local.

## 7. Backup: chaves e criptografia

### Chave de criptografia (manual, na sua máquina)

```bash
age-keygen -o actual-backup-key.txt
```

Guarde o arquivo no gerenciador de senhas. **Só a linha `public key:` vai para
o servidor** (`AGE_RECIPIENT`) — assim o host escreve backups mas não consegue
ler os antigos. O arquivo cifrado contém a chave da Anthropic e as credenciais
Pluggy em texto claro, por isso a criptografia não é opcional.

### Chaves S3 do R2 (manual — não há API)

_R2 → Manage API tokens → Create API token_ com permissão **Object Read &
Write**. Anote Access Key ID, Secret e o endpoint da conta.

## 8. Subir a stack no host

```bash
ssh ubuntu@<IP>
sudo apt-get update && sudo apt-get install -y git
sudo git clone https://github.com/rodrigoaugustov/actual_ai.git /srv/actual/repo
sudo chown -R ubuntu:ubuntu /srv/actual/repo
cd /srv/actual/repo/deploy
cp .env.example .env && chmod 600 .env
```

Preencha o `.env` com: `TUNNEL_TOKEN` (do `.env.generated`), `AGE_RECIPIENT`
(chave pública age), `RCLONE_BUCKET`. Depois configure o rclone:

```bash
rclone config create r2 s3 provider=Cloudflare \
  access_key_id=<KEY> secret_access_key=<SECRET> \
  endpoint=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

E rode o bootstrap — instala Docker, cria `/srv/actual/data` com dono 1001,
instala os timers do systemd e sobe a stack:

```bash
sudo ./bootstrap.sh
```

A partir daqui o deploy contínuo está ligado: todo push no `master` vira imagem
nova, e o host a instala em até 5 minutos com health check e rollback.

## 9. Primeiro login e segredos (manual)

Abra `https://financas.caderninho-digital.com`, crie o usuário admin e faça
login.

Depois, em **Settings**, cole a chave da Anthropic e as credenciais Pluggy.
Elas **não são variáveis de ambiente** — vivem na tabela `secrets` do
`account.sqlite`, gravadas via `POST /secret`. A instância sobe com IA
não-funcional até esse passo, e é por isso que ele não pode ser automatizado
sem colocar chaves em arquivo de configuração.

Instale o PWA no celular: Chrome/Safari → _Adicionar à tela de início_.

## 10. Verificação e monitor

```bash
./verify.sh          # da sua máquina
./verify.sh --host   # no servidor, checa container, timers e backups
```

O check mais importante é o de **headers duplicados**: `Cross-Origin-Opener-Policy`
e `Cross-Origin-Embedder-Policy` precisam aparecer exatamente uma vez. Duplicados
são rejeitados pelo browser e derrubam o `SharedArrayBuffer`, que é o que
sustenta o SQLite no navegador.

Ensaio de restauração — faça uma vez, backup nunca restaurado é palpite:

```bash
AGE_IDENTITY=~/actual-backup-key.txt ./restore.sh --list
AGE_IDENTITY=~/actual-backup-key.txt ./restore.sh <arquivo> --into /tmp/drill
```

**Manual:** cadastre `https://financas.caderninho-digital.com/health` no
UptimeRobot a cada 5 min. Além do alerta, o tráfego evita que a Oracle recicle
a instância Always Free por ociosidade.

---

## O que ficou manual, e por quê

| Passo                                 | Motivo                               |
| ------------------------------------- | ------------------------------------ |
| Visibilidade do pacote no GHCR        | não existe endpoint REST             |
| Upload da chave pública da API Oracle | bootstrap de credencial              |
| Criação do token Cloudflare           | bootstrap de credencial              |
| Chaves S3 do R2                       | não expostas por API                 |
| Senha do admin e chaves de IA no app  | credenciais que só você deve digitar |
| UptimeRobot                           | conta de terceiro, fora do escopo    |

Tudo o mais é reexecutável: os scripts são idempotentes e servem tanto para
recriar o ambiente do zero quanto para migrar de máquina.
