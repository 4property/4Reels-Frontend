#!/usr/bin/env bash
# init.sh — Verificación e inicialización del entorno (4reels front)
#
# Este script lo ejecuta el agente al COMENZAR una sesión y antes de
# declarar cualquier tarea como `done`. Si falla, la sesión no debe avanzar.
#
# Tests E2E (Playwright) NO se corren aquí por coste — los lanza el
# agente explícitamente cuando una feature lo requiere.

set -u
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
fail()  { printf "${RED}[FAIL]${NC}  %s\n" "$1"; }

EXIT_CODE=0

echo "── 1. Verificando entorno ─────────────────────────────"

if ! command -v node >/dev/null 2>&1; then
  fail "node no está instalado"
  exit 1
fi
NODE_VERSION=$(node --version)
ok "node $NODE_VERSION"

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Se requiere Node >= 18 (tienes $NODE_VERSION)"
  EXIT_CODE=1
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm no está instalado"
  EXIT_CODE=1
else
  ok "npm $(npm --version)"
fi

if [ ! -d "node_modules" ]; then
  fail "node_modules/ no existe — ejecuta 'npm install'"
  EXIT_CODE=1
else
  ok "node_modules/ presente"
fi

echo ""
echo "── 2. Verificando archivos base del arnés ──────────────"

for f in AGENTS.md CLAUDE.md feature_list.json progress/current.md docs/architecture.md docs/conventions.md docs/verification.md CHECKPOINTS.md; do
  if [ ! -f "$f" ]; then
    fail "Falta archivo base: $f"
    EXIT_CODE=1
  else
    ok "Existe $f"
  fi
done

echo ""
echo "── 3. Validando feature_list.json ──────────────────────"

node -e '
const fs = require("fs");
try {
  const data = JSON.parse(fs.readFileSync("feature_list.json", "utf8"));
  const valid = new Set(["pending", "in_progress", "done", "blocked"]);
  const inProgress = data.features.filter(f => f.status === "in_progress");
  if (inProgress.length > 1) {
    console.log(`[FAIL]  Hay ${inProgress.length} features en in_progress (máximo 1)`);
    process.exit(1);
  }
  for (const f of data.features) {
    if (!valid.has(f.status)) {
      console.log(`[FAIL]  Estado inválido en feature ${f.id}: ${f.status}`);
      process.exit(1);
    }
  }
  console.log(`[OK]    feature_list.json válido (${data.features.length} features)`);
} catch (e) {
  console.log(`[FAIL]  feature_list.json inválido: ${e.message}`);
  process.exit(1);
}
'
if [ $? -ne 0 ]; then EXIT_CODE=1; fi

echo ""
echo "── 4. Verificando que no hay TypeScript filtrado ───────"

TS_FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | wc -l)
if [ "$TS_FILES" -gt 0 ]; then
  fail "Hay $TS_FILES archivo(s) TypeScript en src/ (prohibido)"
  EXIT_CODE=1
else
  ok "Sin TypeScript en src/"
fi

# Detectar libs prohibidas en package.json
node -e '
const pkg = require("./package.json");
const deps = {...pkg.dependencies, ...pkg.devDependencies};
const banned = ["@tanstack/react-query", "react-query", "msw", "styled-components", "@emotion/react", "@emotion/styled", "tailwindcss", "typescript"];
const found = banned.filter(b => deps[b]);
if (found.length) {
  console.log(`[FAIL]  Dependencias prohibidas: ${found.join(", ")}`);
  process.exit(1);
}
console.log("[OK]    package.json sin libs prohibidas");
' || EXIT_CODE=1

echo ""
echo "── 5. Lint ─────────────────────────────────────────────"

if npm run lint --silent 2>&1 | tail -5; then
  ok "lint verde"
else
  fail "lint rompe"
  EXIT_CODE=1
fi

echo ""
echo "── 6. Build ────────────────────────────────────────────"

if npm run build --silent > /tmp/harness_build.log 2>&1; then
  ok "build verde"
else
  fail "build rompe — revisa /tmp/harness_build.log"
  tail -20 /tmp/harness_build.log
  EXIT_CODE=1
fi

echo ""
echo "── 7. Resumen ──────────────────────────────────────────"

if [ $EXIT_CODE -eq 0 ]; then
  ok "Entorno listo. Puedes empezar a trabajar."
  echo "      Tests E2E no corridos — lanza 'npm run test:smoke' o 'npm run test:e2e' según la feature."
else
  fail "Entorno NO está listo. Resuelve los errores antes de avanzar."
fi

exit $EXIT_CODE
