# Stability suite — 4Reels Frontend — 2026-05-16

Audit after closing sprint features 32-37. Read-only verification rerun.

## 1. init.sh

- Exit code: **0** (verde).
- Lint + build pass, sin warnings.
- Vite build tail (sizes):
  - `dist/assets/index-Cbmx6I_v.css` — **130.76 kB** (gzip 31.24 kB)
  - `dist/assets/index-D-V6gBaL.js`  — **425.28 kB** (gzip 122.08 kB)
  - `✓ built in 2.40s`
- Sin chunks > 500 kB. Sin avisos de `(!) Some chunks are larger than ...`.

## 2. Smoke (`npm run test:smoke`)

- **46 passed / 2 skipped / 0 failed** — coincide con la baseline. Sin regresiones.
- Los 2 skipped son las invariantes conocidas (`tests/flows.spec.js:153 — theme › flips the data-theme attribute` en tablet y mobile).

## 3. E2E full (`npm run test:e2e`)

- **322 passed / 2 skipped / 0 failed** — tiempo total 2.2 m.
- Los 2 skipped son los mismos del smoke (tema en tablet+mobile).
- **Cero flakes en esta ejecución.** Los specs conocidos como propensos a flake en paralelo (`tests/social_templates.spec.js` y `tests/templates.spec.js`) pasaron limpiamente:
  - `social_templates.spec.js`: 30 tests verdes (10 × 3 proyectos).
  - `templates.spec.js`: línea 17 verde en los 3 proyectos.

## 4. Sprint specs targeted (re-run aislado)

```
npx playwright test \
  tests/reels_list_pagination.spec.js \
  tests/agency_outro_upload.spec.js \
  tests/agency_intro_upload.spec.js \
  tests/per_reel_photos_override.spec.js \
  tests/per_reel_subtitles_override.spec.js \
  tests/per_reel_slides_override.spec.js
```

Resultado: **126 passed / 0 skipped / 0 failed** (1.1 m).

| Spec                                        | Tests (desktop+tablet+mobile) |
|---------------------------------------------|-------------------------------|
| `agency_intro_upload.spec.js` (F34)         | 24                            |
| `agency_outro_upload.spec.js` (F33)         | 21                            |
| `per_reel_photos_override.spec.js` (F35)    | 18                            |
| `per_reel_slides_override.spec.js`  (F37)   | 18                            |
| `per_reel_subtitles_override.spec.js` (F36) | 27                            |
| `reels_list_pagination.spec.js` (F32)       | 18                            |
| **Total**                                   | **126**                       |

Todas las features 32-37 verdes en aislado y en suite completa.

## 5. Hard rule scans

- **TypeScript leak** (`find src tests -name '*.ts' -o -name '*.tsx'`): vacío → OK.
- **Direct `fetch(` en componentes**: 11 matches, **todos falsos positivos** — son llamadas a la helper `refetch()` retornada por `useApi`/hooks (e.g. `await refetch()`, `Promise.all([refetch(), refetchDefaults()])`). Ningún `fetch(` real de network. OK.
- **Forbidden deps** (`react-query|msw|styled-components|tailwindcss|@emotion`): vacío → OK.
- **`VITE_*` secret-shaped**: 2 matches y ambos son **comentarios de aviso** en `.env.example` advirtiendo precisamente contra introducir `VITE_ADMIN_API_TOKEN`. No hay ninguna variable real. OK.
- **`console.log` / `debugger`** en `src/`: vacío → OK.

## 6. package.json drift

```diff
+  "license": "GPL-2.0-only",
```

Único cambio. **Sin nuevas dependencias.** `package-lock.json` consistente.

## 7. Bundle size

- CSS: **130.76 kB** (gzip 31.24 kB).
- JS: **425.28 kB** (gzip 122.08 kB).
- Chunks > 500 kB: **ninguno**.
- Comparación informal vs. revisores en sprint: el CSS había crecido de 119 kB → ~126 kB durante el sprint; ahora está en **130.76 kB**, dentro del rango esperado por las features 32-37 (paginación + filtros, intro/outro upload UI, locked banners en photos/subtitles/slides override). El JS principal sigue holgadamente por debajo del umbral de 500 kB de Vite.

## 8. Git status

- Rama: `main`, up-to-date con `origin/main`.
- **72 archivos modificados** en working tree (sin commits sobre origin/main todavía).
- **+9 615 / -1 169** líneas (delta neto +8 446) — incluye `tests/support/mock-backend.js` con +2 437 líneas (handlers ampliados de los features 32-37) y la cosecha completa del sprint.
- Un fichero borrado tracked: `src/features/defaults/LivePreview.jsx` (limpieza de feature 31, cleanup de la pestaña subtitles).

## 9. Verdict

**STABLE.**

`init.sh` verde, smoke en baseline (46/2/0), E2E full sin failures ni flakes (322/2/0), specs de los sprints 32-37 verdes en aislado (126/0/0). Las reglas duras se respetan: sin TypeScript, sin fetch directo en componentes, sin libs prohibidas, sin secretos `VITE_*`, sin `console.log`/`debugger` residuales. `package.json` solo añade el campo `license` — cero dependencias nuevas. El bundle CSS quedó en 130.76 kB (esperable tras las features visibles del sprint) y el JS en 425.28 kB sin chunks > 500 kB. No se detectan regresiones ni cleanups pendientes.
