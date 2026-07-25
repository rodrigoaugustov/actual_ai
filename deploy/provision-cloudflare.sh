#!/usr/bin/env bash
#
# Provisions everything this deployment needs on Cloudflare, via the REST API.
#
#   CF_API_TOKEN=... ./provision-cloudflare.sh
#
# Idempotent: re-running reuses the existing tunnel and DNS record instead of
# creating duplicates. Safe to run again after changing HOSTNAME or the origin.
#
# Creates / configures:
#   1. a named cloudflared tunnel (config managed by Cloudflare, not by a file)
#   2. its ingress rule  hostname -> http://actual:5006
#   3. a proxied CNAME  hostname -> <tunnel-id>.cfargotunnel.com
#   4. zone settings that would otherwise break the app (see below)
#   5. the R2 bucket for backups
#
# Writes the tunnel token to deploy/.env.generated. That file is gitignored and
# contains a credential — move it to the server and delete the local copy.

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

HOSTNAME_FQDN="${HOSTNAME_FQDN:-financas.caderninho-digital.com}"
ZONE_NAME="${ZONE_NAME:-caderninho-digital.com}"
TUNNEL_NAME="${TUNNEL_NAME:-actual-ai}"
ORIGIN="${ORIGIN:-http://actual:5006}"
R2_BUCKET="${R2_BUCKET:-actual-backups}"
OUTPUT="${OUTPUT:-$DEPLOY_DIR/.env.generated}"

API=https://api.cloudflare.com/client/v4

: "${CF_API_TOKEN:?set CF_API_TOKEN — see docs/DEPLOY.md for the required scopes}"

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

# cf <METHOD> <PATH> [BODY]
# Unwraps the envelope and fails loudly on API errors, which otherwise come back
# as HTTP 200 with "success": false.
cf() {
  local method="$1" path="$2" body="${3:-}" response
  if [[ -n "$body" ]]; then
    response="$(curl --silent --show-error --request "$method" "$API$path" \
      --header "Authorization: Bearer $CF_API_TOKEN" \
      --header 'Content-Type: application/json' \
      --data "$body")"
  else
    response="$(curl --silent --show-error --request "$method" "$API$path" \
      --header "Authorization: Bearer $CF_API_TOKEN")"
  fi
  if [[ "$(jq -r '.success' <<<"$response")" != "true" ]]; then
    printf 'Cloudflare API error on %s %s:\n' "$method" "$path" >&2
    jq -r '.errors' <<<"$response" >&2
    return 1
  fi
  jq -r '.result' <<<"$response"
}

say "Verifying the token"
cf GET /user/tokens/verify >/dev/null
echo "    token OK"

say "Resolving account and zone"
ZONE="$(cf GET "/zones?name=$ZONE_NAME")"
ZONE_ID="$(jq -r '.[0].id // empty' <<<"$ZONE")"
ACCOUNT_ID="$(jq -r '.[0].account.id // empty' <<<"$ZONE")"
[[ -n "$ZONE_ID" ]] || { echo "zone $ZONE_NAME not found — does the token have Zone:Read on it?" >&2; exit 1; }
echo "    zone    $ZONE_NAME -> $ZONE_ID"
echo "    account $ACCOUNT_ID"

say "Tunnel '$TUNNEL_NAME'"
# is_deleted filters out tombstones of tunnels with the same name.
TUNNEL_ID="$(cf GET "/accounts/$ACCOUNT_ID/cfd_tunnel?name=$TUNNEL_NAME&is_deleted=false" \
  | jq -r '.[0].id // empty')"

if [[ -n "$TUNNEL_ID" ]]; then
  echo "    reusing $TUNNEL_ID"
else
  # config_src=cloudflare keeps the ingress rules server-side, so the container
  # only ever needs the token — no config file to ship or keep in sync.
  SECRET="$(head -c 32 /dev/urandom | base64 | tr -d '\n')"
  TUNNEL_ID="$(cf POST "/accounts/$ACCOUNT_ID/cfd_tunnel" \
    "$(jq -n --arg n "$TUNNEL_NAME" --arg s "$SECRET" \
      '{name: $n, config_src: "cloudflare", tunnel_secret: $s}')" | jq -r '.id')"
  echo "    created $TUNNEL_ID"
fi

say "Ingress: $HOSTNAME_FQDN -> $ORIGIN"
# noTLSVerify is irrelevant here (plain http to a container on the same docker
# network) but connectTimeout matters: advisor runs are long-lived SSE streams.
cf PUT "/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" \
  "$(jq -n --arg h "$HOSTNAME_FQDN" --arg s "$ORIGIN" '{
    config: {
      ingress: [
        {hostname: $h, service: $s, originRequest: {connectTimeout: 30, noHappyEyeballs: false}},
        {service: "http_status:404"}
      ]
    }
  }')" >/dev/null
echo "    configured"

say "DNS: $HOSTNAME_FQDN"
TARGET="$TUNNEL_ID.cfargotunnel.com"
RECORD_ID="$(cf GET "/zones/$ZONE_ID/dns_records?name=$HOSTNAME_FQDN&type=CNAME" \
  | jq -r '.[0].id // empty')"
BODY="$(jq -n --arg n "$HOSTNAME_FQDN" --arg c "$TARGET" \
  '{type: "CNAME", name: $n, content: $c, proxied: true, comment: "actual-ai tunnel"}')"

if [[ -n "$RECORD_ID" ]]; then
  cf PATCH "/zones/$ZONE_ID/dns_records/$RECORD_ID" "$BODY" >/dev/null
  echo "    updated -> $TARGET"
else
  cf POST "/zones/$ZONE_ID/dns_records" "$BODY" >/dev/null
  echo "    created -> $TARGET"
fi

say "Zone settings"
# Rocket Loader, Auto Minify and Email Obfuscation all inject inline script into
# the HTML. The production CSP has no 'unsafe-inline', so any of them turns the
# app into a blank page. This is the single most likely way to break the deploy
# from the Cloudflare side, so it is enforced here rather than left to a
# checklist item.
for setting in rocket_loader email_obfuscation; do
  if cf PATCH "/zones/$ZONE_ID/settings/$setting" '{"value":"off"}' >/dev/null 2>&1; then
    echo "    $setting = off"
  else
    echo "    ! could not set $setting — turn it off by hand in the dashboard"
  fi
done
# Auto Minify was retired for new zones; ignore a failure here.
cf PATCH "/zones/$ZONE_ID/settings/minify" \
  '{"value":{"css":"off","html":"off","js":"off"}}' >/dev/null 2>&1 \
  && echo "    minify = off" \
  || echo "    minify not applicable on this zone (retired setting)"

say "R2 bucket '$R2_BUCKET'"
if cf GET "/accounts/$ACCOUNT_ID/r2/buckets/$R2_BUCKET" >/dev/null 2>&1; then
  echo "    already exists"
else
  cf POST "/accounts/$ACCOUNT_ID/r2/buckets" \
    "$(jq -n --arg n "$R2_BUCKET" '{name: $n}')" >/dev/null \
    && echo "    created" \
    || echo "    ! could not create — needs the Workers R2 Storage:Edit scope"
fi

say "Tunnel token"
TOKEN="$(cf GET "/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/token")"

umask 077
cat >"$OUTPUT" <<EOF
# Generated by provision-cloudflare.sh on $(date -Is)
# Contains a credential. Move to the server's deploy/.env and delete this file.
TUNNEL_TOKEN=$TOKEN
RCLONE_BUCKET=$R2_BUCKET
EOF

cat <<EOF

Done.

  hostname   https://$HOSTNAME_FQDN
  tunnel     $TUNNEL_ID
  account    $ACCOUNT_ID
  token      written to $OUTPUT

Still manual (no API for these):
  * R2 S3 access keys — R2 > Manage API tokens in the dashboard.
    Feed them to: rclone config create r2 s3 provider=Cloudflare ...

The hostname stays unreachable until cloudflared is running on the host with
this token. That is expected.
EOF
