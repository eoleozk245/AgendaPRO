#!/usr/bin/env bash
# Sobe um PostgreSQL temporário, aplica supabase/migrations e roda supabase/tests.
# Requer PostgreSQL 15+ e pgTAP instalados (ex.: apt install postgresql-16 postgresql-16-pgtap).
# Uso: scripts/test-db.sh            (ou PG_BIN=/caminho/bin scripts/test-db.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${PG_TEST_PORT:-54329}"
WORK="$(mktemp -d)"
chmod 755 "$WORK"

# O PostgreSQL não roda como root; nesse caso usa o usuário "postgres".
run() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

cleanup() {
  run "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

[ "$(id -u)" = "0" ] && chown postgres "$WORK"
run "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
run "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -d postgres -c "create database agendapro_test" >/dev/null
sed "s/current_database_placeholder/agendapro_test/" "$ROOT/supabase/tests/support/supabase_stub.sql" \
  | "${PSQL[@]}" -d agendapro_test >/dev/null

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "migração: $(basename "$migration")"
  "${PSQL[@]}" -d agendapro_test -f "$migration" >/dev/null
done

status=0
for test in "$ROOT"/supabase/tests/*.test.sql; do
  echo "teste: $(basename "$test")"
  output="$("${PSQL[@]}" -d agendapro_test -t -A -f "$test" 2>&1)" || status=1
  echo "$output" | grep -E '^(ok|not ok|#|1\.\.)' || true
  if echo "$output" | grep -qE '^not ok|ERROR|Looks like'; then
    echo "$output" | grep -vE '^(ok|1\.\.)' >&2
    status=1
  fi
done

[ "$status" = "0" ] && echo "Banco: todos os testes passaram." || echo "Banco: há falhas." >&2
exit "$status"
