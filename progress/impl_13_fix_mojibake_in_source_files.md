# Implementación feature 13 — `fix_mojibake_in_source_files`

**Fecha:** 2026-05-13
**Implementer:** Claude (Opus 4.7)
**Origen del problema:** Inventario en `progress/explore_mojibake_inventory.md`
(13 archivos, 38 ocurrencias, 11 patrones de UTF-8 doblemente codificado).

## Estrategia aplicada

Reemplazo por pares explícitos, **no** `encode('latin-1').decode('utf-8')`
sobre el archivo completo (el inventario advertía del riesgo de romper
caracteres UTF-8 correctos en zonas mixtas).

Script auxiliar en `/tmp/fix_mojibake.py` (no forma parte del proyecto;
fuera del árbol de fuentes). Hace:

1. Lee cada archivo como UTF-8.
2. Aplica los pares de mayor a menor longitud para evitar que la
   sustitución de `Â·` (2 chars) coma bytes que pertenecen a triples
   como `â‚¬` (esa precaución es defensiva — en este caso los triples
   no contienen `Â`, pero la regla queda consistente).
3. Re-escribe como UTF-8.

### Pre-análisis para decidir mapeo de `â€X`

El inventario tenía una ambigüedad: `â€"` aparecía con dos significados
posibles (em-dash o right-double-quote). Antes de fijar el mapeo extraje
todos los triples `â€.` distintos presentes en el repo:

```
'â€¦' -> ['0xe2', '0x20ac', '0xa6']    # ellipsis
'â€"' -> ['0xe2', '0x20ac', '0x201d']  # em dash
```

Sólo existen dos triples reales en el código; **todos los `â€"` son
em-dashes**, ninguno es right-double-quote. Mapeo decidido sin riesgo.

## Pares aplicados

| Mojibake | Carácter | Comentario |
|----------|----------|------------|
| `â€¦` | `…` | ellipsis |
| `â€"` | `—` | em dash (único significado en este repo) |
| `â€™` | `'` | right single quote (defensivo; sin hits) |
| `â€"` | `"` | left double quote (defensivo; sin hits) |
| `â‚¬` | `€` | euro |
| `â‰¤` | `≤` | less or equal |
| `â†'` | `→` | right arrow |
| `âŒ˜` | `⌘` | command key |
| `âœ"` | `✓` | heavy check |
| `Â·`  | `·` | middle dot (último, tras los triples) |

## Archivos modificados (13)

| Archivo | Bytes antes → después | Naturaleza |
|---------|------------------------|------------|
| `src/app/pages.js` | 1448 → 1433 | comentarios JSDoc |
| `src/app/Shell.jsx` | 4638 → 4631 | `data-screen-label` + JSDoc |
| `src/app/Topbar.jsx` | 5864 → 5851 | placeholder, `⌘K`, label |
| `src/app/providers/TenantProvider.jsx` | 6209 → 6183 | samples renderizadas (`·`, `€`) + JSDoc |
| `src/features/admin/AdminView.jsx` | 9021 → 9017 | "Loading…" |
| `src/features/brand/api.js` | 1424 → 1409 | comentarios |
| `src/features/defaults/api.js` | 930 → 920 | comentarios |
| `src/features/reels/editor/ReelEditor.jsx` | 15829 → 15786 | header `·`, fallbacks `—`, "Loading…", tooltip, comentarios |
| `src/features/session/SessionProvider.jsx` | 13121 → 13116 | comentario |
| `src/features/session/ghlMvpContext.js` | 15723 → 15718 | comentario |
| `src/lib/api/client.js` | 6625 → 6610 | comentarios JSDoc |
| `tests/flows.spec.js` | 6217 → 6212 | comentario |
| `tests/support/mock-backend.js` | 21925 → 21920 | comentario |

Sin cambios de lógica, indentación, EOL ni imports. Sólo bytes mojibake
reemplazados por sus caracteres originales.

## Verificación

```
$ grep -rn -P "â€|Â·|â‚¬|â‰¤|â†|âŒ˜|âœ" src/ tests/
EXIT=1   # 0 hits

$ file --mime-encoding <cada uno de los 13 archivos>
... : utf-8   # todos siguen utf-8 válido
```

Acceptance points spot-checked en disco:

- `src/app/Topbar.jsx:72` → `placeholder="Search reels, properties…"` ✓
- `src/app/Topbar.jsx:73` → `<span className="kbd">⌘K</span>` ✓
- `src/features/reels/editor/ReelEditor.jsx:331` → `{reel.address && <> · {reel.address}</>}` ✓
- `src/features/reels/editor/ReelEditor.jsx:406,409` → fallback `'—'` en Render/Workflow ✓
- `src/app/providers/TenantProvider.jsx:21,22` → `'2-bed apartment · Cranford Court'` y `'€385,000'` ✓

### lint / build (`./init.sh`)

```
── 5. Lint ─────────────────────────────────────────────
[OK]    lint verde
── 6. Build ────────────────────────────────────────────
[OK]    build verde
── 7. Resumen ──────────────────────────────────────────
[OK]    Entorno listo.
```

### `npm run test:smoke`

```
43 passed
2 skipped   (theme spec — skipped previo a este cambio)
0 failed
duración: 1.0m
```

Ningún test rompió. No fue necesario actualizar selectores de tests (no
había selectores apuntando a literales mojibake).

## Decisiones no obvias

- **Sin script en el repo:** el helper Python vive en `/tmp/`. La feature
  es one-shot y el script no aporta valor a futuro.
- **Mapeo determinista para `â€"`:** comprobé los triples reales antes
  de aplicar reemplazos, eliminando la ambigüedad mencionada en el
  inventario. Sólo aparece como em-dash en este repo.
- **Orden long-first:** aunque en este corpus específico no hay
  solapamiento entre los triples y `Â·`, mantener el orden por longitud
  decreciente es robusto si en el futuro aparece, por ejemplo, `Â¿`.

## Estado

Feature 13 lista para review. No modifiqué `feature_list.json` a `done`
(según el protocolo del implementer, eso lo hace el leader tras el OK
del reviewer).
