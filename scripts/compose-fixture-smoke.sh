#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
PROJECT=station-fixture-smoke
URL=http://127.0.0.1:29173/park
COMPOSE="docker compose -p $PROJECT -f compose.smoke.yml"

cleanup() {
  $COMPOSE down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

$COMPOSE up --build -d --wait --wait-timeout 180

i=0
while [ "$i" -lt 60 ]; do
  if curl -fsS "$URL" | grep -Eqi 'park-card|Approve|Needs you'; then
    echo "compose fixture smoke ok: $URL"
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done

echo "compose fixture smoke failed: $URL never showed a parked fixture" >&2
$COMPOSE logs --no-color --tail=80 station >&2 || true
exit 1
