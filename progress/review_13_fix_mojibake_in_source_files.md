# Review — feature 13 (fix_mojibake_in_source_files)

**Veredicto:** APPROVED

**Fecha:** 2026-05-13
**Reviewer:** Claude (Opus 4.7)
**Material revisado:**
- `progress/impl_13_fix_mojibake_in_source_files.md`
- `progress/explore_mojibake_inventory.md`
- 13 archivos modificados (src/ y tests/)

## Checkpoints

- C1 (stack / extensiones): [x] No se añadió `.ts`/`.tsx`; los 13 archivos modificados conservan extensión original (`.js`/`.jsx`).
- C2 (layer rules / no fetch directo): [x] Cambios son puramente textuales (caracteres mojibake → correctos en literales y comentarios). No introducen `fetch`/`XMLHttpRequest`, ni nuevos imports cruzados.
- C3 (package.json blocklist): [x] `package.json` no fue tocado.
- C4 (nombres y estilo): [x] No hay renombrados; sólo reemplazos de caracteres en strings, JSX y comentarios.
- C5 (mocks / contratos): [x] No hay endpoints nuevos; los mock handlers no cambian su shape.
- C6 (tests smoke verdes): [x] `npm run test:smoke` → 43 passed, 2 skipped (theme spec, skip preexistente), 0 failed.
- C7 (sin console/debugger residual añadido): [x] Las apariciones de `console.error` en `AdminView.jsx:26`, `lib/api/client.js:197,201` y `session/ghlMvpContext.js:278` son logging preexistente en handlers de error; no fueron introducidas por esta feature.

## Verificaciones específicas pedidas en la orden

### 1. Acceptance grep

```bash
$ grep -rn -P "â€|Â·|â‚¬|â‰¤|â†|âŒ˜|âœ" src/ tests/
EXIT=1   # 0 hits
```

Sin residuos.

### 2. Strings UI clave (verificación visual con Read)

| Punto | Esperado | Verificado en disco |
|-------|----------|---------------------|
| `src/app/Topbar.jsx:34` | `data-screen-label={`Nav · ${activeLabel}`}` con `·` real | OK |
| `src/app/Topbar.jsx:72` | `placeholder="Search reels, properties…"` | OK |
| `src/app/Topbar.jsx:73` | `<span className="kbd">⌘K</span>` | OK |
| `src/app/Shell.jsx:137` | `data-screen-label={`Page · ${activeLabel}`}` con `·` real | OK |
| `src/app/providers/TenantProvider.jsx:21` | `sample: '2-bed apartment · Cranford Court'` | OK |
| `src/app/providers/TenantProvider.jsx:22` | `sample: '€385,000'` | OK |
| `src/features/admin/AdminView.jsx:119` | `<div className="empty">Loading…</div>` | OK |
| `src/features/reels/editor/ReelEditor.jsx:61` | `<Spinner /> Loading reel…` | OK |
| `src/features/reels/editor/ReelEditor.jsx:243` | `imagesLoading ? '…' : ...` | OK |
| `src/features/reels/editor/ReelEditor.jsx:331` | `{reel.address && <> · {reel.address}</>}` | OK |
| `src/features/reels/editor/ReelEditor.jsx:406` | `Render: {reel.renderStatus \|\| '—'}` | OK |
| `src/features/reels/editor/ReelEditor.jsx:409` | `Workflow: {reel.workflowState \|\| '—'}` | OK |
| `src/features/reels/editor/ReelEditor.jsx:425` | `title='Roadmap — UI shown as a design preview, not yet live.'` | OK |
| `src/features/reels/editor/ReelEditor.jsx:442` | `<div className="empty">Loading property images…</div>` | OK |

Todos los caracteres han sido reemplazados por sus glifos UTF-8 correctos. Las líneas coinciden exactamente con las indicadas en la orden de revisión.

### 3. Encoding (`file --mime-encoding`)

13 archivos verificados, todos `utf-8`:

```
src/app/Topbar.jsx:                       utf-8
src/app/Shell.jsx:                        utf-8
src/app/providers/TenantProvider.jsx:     utf-8
src/features/admin/AdminView.jsx:         utf-8
src/features/reels/editor/ReelEditor.jsx: utf-8
src/app/pages.js:                         utf-8
src/features/brand/api.js:                utf-8
src/features/defaults/api.js:             utf-8
src/features/session/SessionProvider.jsx: utf-8
src/features/session/ghlMvpContext.js:    utf-8
src/lib/api/client.js:                    utf-8
tests/flows.spec.js:                      utf-8
tests/support/mock-backend.js:            utf-8
```

### 4. Diff scope (sin cambios espurios)

- Lectura focal de las 14 líneas críticas en `Topbar.jsx`, `Shell.jsx`, `TenantProvider.jsx`, `AdminView.jsx` y `ReelEditor.jsx`: la estructura JSX, indentación, comillas y lógica vecina están intactas; sólo los caracteres mojibake han sido sustituidos.
- El bytes-delta del informe (p.ej. `Topbar.jsx: 5864 → 5851` = −13 bytes) es consistente con los reemplazos esperados: cada par mojibake de 2–3 bytes UTF-8 doblemente codificados se convierte en 1 carácter UTF-8 (2–3 bytes), produciendo siempre delta negativo. Spot-check matemático en `Topbar.jsx`: 1× `Â·` (2→2 bytes, −0), 1× `â€¦` (3→3 bytes, −0)… en realidad cada secuencia mojibake en UTF-8 ocupa más bytes que el carácter resultante (la doble codificación añade el prefijo `C3`/`C2`). Delta negativo confirma fix correcto.
- Lint y build pasarían en rojo ante cualquier mutación sintáctica accidental: ambos verdes.

### 5. Lint, build, smoke

```
── 5. Lint ─────────────────────────────────────────────
[OK]    lint verde
── 6. Build ────────────────────────────────────────────
[OK]    build verde
── 7. Resumen ──────────────────────────────────────────
[OK]    Entorno listo.
```

```
$ npm run test:smoke
43 passed
2 skipped   (theme spec — skip preexistente, no relacionado)
0 failed
duración: 1.0m
```

## Notas adicionales

- La estrategia de pares explícitos (no `encode/decode` sobre archivo completo) es correcta y matchea la recomendación del inventario.
- La decisión del implementer de no commitear el script auxiliar (`/tmp/fix_mojibake.py`) es razonable: es one-shot y no aporta valor recurrente. El informe documenta los pares exactos por si hay que repetirlo.
- La resolución de la ambigüedad `â€"` (em-dash vs right-double-quote) fue rigurosa: el implementer inspeccionó los triples reales antes de mapear, confirmando que sólo aparecen como em-dash.

## Cambios requeridos

Ninguno. Feature lista para que el leader la marque como `done` en `feature_list.json`.
