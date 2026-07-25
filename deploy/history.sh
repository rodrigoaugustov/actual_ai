#!/usr/bin/env bash
#
# Manual build/deploy history for an SSH session on the production VM.
#
#   ./history.sh       # last 20 builds/deploy events
#   ./history.sh 50    # last 50

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

LIMIT="${1:-20}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-rodrigoaugustov/actual_ai}"
WORKFLOW="${GITHUB_WORKFLOW:-fork-image.yml}"

[[ "$LIMIT" =~ ^[1-9][0-9]*$ ]] || die "limit must be a positive integer"
command -v jq >/dev/null || die "jq is required (sudo apt-get install jq)"

printf 'CURRENTLY RUNNING\n'
container_id="$(compose ps --quiet actual)"
if [[ -z "$container_id" ]]; then
  printf 'Actual container is not running.\n'
else
  image_id="$(docker inspect --format '{{.Image}}' "$container_id")"
  image_ref="$(docker inspect --format '{{.Config.Image}}' "$container_id")"
  state="$(docker inspect --format '{{.State.Status}}' "$container_id")"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}' "$container_id")"
  started="$(docker inspect --format '{{.State.StartedAt}}' "$container_id")"
  labels="$(docker image inspect --format '{{json .Config.Labels}}' "$image_id")"

  printf 'Image:    %s\n' "$image_ref"
  printf 'Client:   v%s\n' "$(jq -r '."io.actual.client.version" // "not recorded"' <<<"$labels")"
  printf 'Server:   v%s\n' "$(jq -r '."io.actual.server.version" // "not recorded"' <<<"$labels")"
  printf 'Revision: %s\n' "$(jq -r '."org.opencontainers.image.revision" // "not recorded"' <<<"$labels")"
  printf 'Created:  %s\n' "$(jq -r '."org.opencontainers.image.created" // "not recorded"' <<<"$labels")"
  printf 'State:    %s (health: %s)\n' "$state" "$health"
  printf 'Started:  %s\n' "$started"
fi

printf '\nRECENT DEPLOYS ON THIS VM\n'
journalctl --unit actual-update.service --no-pager --output short-iso \
  | grep --extended-regexp 'new image available|healthy on|Deploy (OK|FAILED|ABORTED)|Rolled back|Rollback FAILED' \
  | tail --lines "$LIMIT" \
  || true

printf '\nRECENT IMAGE BUILDS ON GITHUB\n'
headers=(
  --header 'Accept: application/vnd.github+json'
  --header 'X-GitHub-Api-Version: 2022-11-28'
)
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  headers+=(--header "Authorization: Bearer $GITHUB_TOKEN")
fi

curl --fail --silent --show-error \
  "${headers[@]}" \
  "https://api.github.com/repos/$GITHUB_REPOSITORY/actions/workflows/$WORKFLOW/runs?per_page=$LIMIT" \
  | jq -r '
      .workflow_runs[]
      | "\(.created_at)  \(.head_sha[0:7])  \(.status)/\(.conclusion // "-")  \(.html_url)"
    '
