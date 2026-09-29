#!/usr/bin/env bash
# Prueba migraciones, semilla y RLS en un Postgres local desechable (requiere Docker).
set -euo pipefail
cd "$(dirname "$0")/.."

NAME=micasa-db-test
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test postgres:16-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT

until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 2

run() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

run < supabase/tests/stubs.sql
for f in supabase/migrations/*.sql; do echo "→ $f"; run < "$f"; done
echo "→ seed (1ª vez)"; run < supabase/seed.sql
echo "→ seed (2ª vez, idempotencia)"; run < supabase/seed.sql
run -c "select count(*) filter (where parent_id is null) as categorias, count(*) filter (where parent_id is not null) as subcategorias, (select count(*) from public.product_templates) as plantillas from public.categories"
echo "→ pruebas RLS"; run < supabase/tests/rls.test.sql
