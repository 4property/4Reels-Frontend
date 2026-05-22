#!/usr/bin/env bash
# init.sh — Environment verification and initialization (4reels front)
#
# The agent runs this script at the START of a session and before
# declaring any task as `done`. If it fails, the session must not advance.
#
# E2E tests (Playwright) are NOT run here for cost reasons — the agent
# launches them explicitly when a feature requires it.

set -u
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
fail()  { printf "${RED}[FAIL]${NC}  %s\n" "$1"; }

EXIT_CODE=0

echo "── 1. Verifying environment ───────────────────────────"

if ! command -v node >/dev/null 2>&1; then
  fail "node is not installed"
  exit 1
fi
NODE_VERSION=$(node --version)
ok "node $NODE_VERSION"

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node >= 18 is required (you have $NODE_VERSION)"
  EXIT_CODE=1
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is not installed"
  EXIT_CODE=1
else
  ok "npm $(npm --version)"
fi

if [ ! -d "node_modules" ]; then
  fail "node_modules/ does not exist — run 'npm install'"
  EXIT_CODE=1
else
  ok "node_modules/ present"
fi

echo ""
echo "── 2. Verifying harness base files ────────────────────"

for f in AGENTS.md CLAUDE.md feature_list.json progress/current.md docs/architecture.md docs/conventions.md docs/verification.md CHECKPOINTS.md; do
  if [ ! -f "$f" ]; then
    fail "Missing base file: $f"
    EXIT_CODE=1
  else
    ok "Exists $f"
  fi
done

echo ""
echo "── 3. Validating feature_list.json ────────────────────"

node -e '
const fs = require("fs");
try {
  const data = JSON.parse(fs.readFileSync("feature_list.json", "utf8"));
  const valid = new Set(["pending", "in_progress", "done", "blocked"]);
  const inProgress = data.features.filter(f => f.status === "in_progress");
  if (inProgress.length > 1) {
    console.log(`[FAIL]  There are ${inProgress.length} features in in_progress (maximum 1)`);
    process.exit(1);
  }
  for (const f of data.features) {
    if (!valid.has(f.status)) {
      console.log(`[FAIL]  Invalid status in feature ${f.id}: ${f.status}`);
      process.exit(1);
    }
  }
  console.log(`[OK]    feature_list.json valid (${data.features.length} features)`);
} catch (e) {
  console.log(`[FAIL]  feature_list.json invalid: ${e.message}`);
  process.exit(1);
}
'
if [ $? -ne 0 ]; then EXIT_CODE=1; fi

echo ""
echo "── 4. Verifying no leaked TypeScript ──────────────────"

TS_FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | wc -l)
if [ "$TS_FILES" -gt 0 ]; then
  fail "There are $TS_FILES TypeScript file(s) in src/ (forbidden)"
  EXIT_CODE=1
else
  ok "No TypeScript in src/"
fi

# Detect forbidden libs in package.json
node -e '
const pkg = require("./package.json");
const deps = {...pkg.dependencies, ...pkg.devDependencies};
const banned = ["@tanstack/react-query", "react-query", "msw", "styled-components", "@emotion/react", "@emotion/styled", "tailwindcss", "typescript"];
const found = banned.filter(b => deps[b]);
if (found.length) {
  console.log(`[FAIL]  Forbidden dependencies: ${found.join(", ")}`);
  process.exit(1);
}
console.log("[OK]    package.json has no forbidden libs");
' || EXIT_CODE=1

echo ""
echo "── 5. Lint ────────────────────────────────────────────"

if npm run lint --silent 2>&1 | tail -5; then
  ok "lint green"
else
  fail "lint broken"
  EXIT_CODE=1
fi

echo ""
echo "── 6. Build ───────────────────────────────────────────"

if npm run build --silent > /tmp/harness_build.log 2>&1; then
  ok "build green"
else
  fail "build broken — check /tmp/harness_build.log"
  tail -20 /tmp/harness_build.log
  EXIT_CODE=1
fi

echo ""
echo "── 7. Summary ─────────────────────────────────────────"

if [ $EXIT_CODE -eq 0 ]; then
  ok "Environment ready. You can start working."
  echo "      E2E tests not run — launch 'npm run test:smoke' or 'npm run test:e2e' as the feature requires."
else
  fail "Environment is NOT ready. Resolve the errors before continuing."
fi

exit $EXIT_CODE
