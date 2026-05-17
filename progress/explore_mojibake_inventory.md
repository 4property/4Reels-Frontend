# Inventario mojibake en el frontend

**Fecha:** 2026-05-13
**Origen:** El usuario reporta "símbolos raros" en la UI tras configurar
`require approval`. Tras descartar HTML-entity decoding como causa, encontré
que **varios archivos fuente del frontend están UTF-8 doblemente codificados**.

## Diagnóstico

Los archivos están declarados UTF-8 (`file --mime-encoding` → `utf-8`), pero
contienen las secuencias resultantes de leer bytes UTF-8 como Latin-1/CP1252
y volver a codificarlos a UTF-8. Es double-encoding clásico.

Ejemplo: el em-dash `—` es `E2 80 94` en UTF-8. Leído como Latin-1 da `â € ”`
y al re-encodearse a UTF-8 produce los bytes `C3 A2 E2 82 AC E2 80 9D` — los
caracteres que vemos en pantalla como `â€”`.

## Patrones encontrados y carácter original

| Mojibake | Carácter original | Bytes UTF-8 originales |
|----------|-------------------|------------------------|
| `â€—` | `—` em dash       | E2 80 94 |
| `â€“` | `“` left double quote | E2 80 9C |
| `â€”` | `”` right double quote | E2 80 9D |
| `â€™` | `'` right single quote | E2 80 99 |
| `â€¦` | `…` ellipsis | E2 80 A6 |
| `Â·` | `·` middle dot | C2 B7 |
| `â‚¬` | `€` euro | E2 82 AC |
| `â‰¤` | `≤` less or equal | E2 89 A4 |
| `â†’` | `→` right arrow | E2 86 92 |
| `âŒ˜` | `⌘` command key | E2 8C 98 |
| `âœ”` | `✓` heavy check | E2 9C 93 |

## Inventario por archivo

13 archivos afectados, 38 ocurrencias totales.

### Strings renderizadas al usuario (impacto UI)

| Archivo | Línea | Mojibake | Contexto |
|---------|-------|----------|----------|
| `src/app/Shell.jsx` | 137 | `Â·` | `data-screen-label="Page · ..."` |
| `src/app/Topbar.jsx` | 34 | `Â·` | `data-screen-label="Nav · ..."` |
| `src/app/Topbar.jsx` | 72 | `â€¦` | placeholder "Search reels, properties…" |
| `src/app/Topbar.jsx` | 73 | `âŒ˜` | `<span className="kbd">⌘K</span>` |
| `src/features/admin/AdminView.jsx` | 119 | `â€¦` | "Loading…" |
| `src/app/providers/TenantProvider.jsx` | 21 | `Â·` | sample "2-bed apartment · Cranford Court" |
| `src/app/providers/TenantProvider.jsx` | 22 | `â‚¬` | sample "€385,000" |
| `src/features/reels/editor/ReelEditor.jsx` | 61 | `â€¦` | "Loading reel…" |
| `src/features/reels/editor/ReelEditor.jsx` | 243 | `â€¦` | ellipsis truncado |
| `src/features/reels/editor/ReelEditor.jsx` | 331 | `Â·` | "· {reel.address}" en header |
| `src/features/reels/editor/ReelEditor.jsx` | 406, 409 | `â€”` | fallback "—" Render/Workflow |
| `src/features/reels/editor/ReelEditor.jsx` | 425 | `â€”` | tooltip "Roadmap — UI shown ..." |
| `src/features/reels/editor/ReelEditor.jsx` | 442 | `â€¦` | "Loading property images…" |

### Comentarios JSDoc / inline (no impacta UI, pero conviene limpiar)

| Archivo | Líneas |
|---------|--------|
| `src/app/pages.js` | 2, 10, 11 |
| `src/app/Shell.jsx` | 18 |
| `src/app/Topbar.jsx` | 16 |
| `src/app/providers/TenantProvider.jsx` | 5, 6, 7, 8 |
| `src/features/defaults/api.js` | 6, 10 |
| `src/features/brand/api.js` | 6, 7, 10 |
| `src/features/session/SessionProvider.jsx` | 10 |
| `src/features/session/ghlMvpContext.js` | 148 |
| `src/lib/api/client.js` | 6, 9, 25 |
| `src/features/reels/editor/ReelEditor.jsx` | 2, 17, 128 |
| `tests/flows.spec.js` | 11 |
| `tests/support/mock-backend.js` | 4 |

## Estrategia de fix recomendada

Reemplazos por pares explícitos, no `encode('latin-1').decode('utf-8')` ciego
sobre el archivo entero — algunos archivos pueden contener caracteres UTF-8
correctos en otras zonas, y el encode latin-1 fallaría si encuentra algo
fuera del rango.

Pares (en orden — los multi-byte primero para evitar coincidencias parciales):

```
â€— → —   (em dash)
â€“ → “   (left double quote)
â€” → ”   (right double quote)
â€™ → ’   (right single quote)
â€¦ → …   (ellipsis)
â‚¬ → €   (euro)
â‰¤ → ≤   (less or equal)
â†’ → →   (right arrow)
âŒ˜ → ⌘   (command key)
âœ” → ✓   (heavy check)
Â· → ·   (middle dot, NB: hacer este último porque Â aparece dentro
                de las otras secuencias también)
Â  →     (mojibake del nbsp si aparece; verificar)
```

## Verificación pos-fix

```bash
grep -rn -P "â€|Â·|â‚¬|â‰¤|â†|âŒ˜|âœ" src/ tests/   # debe devolver 0
file --mime-encoding src/app/Topbar.jsx                # utf-8
./init.sh                                               # verde
npm run test:smoke                                      # verde
```

Y verificación manual en la UI:
- Topbar: placeholder "Search reels, properties…" y kbd "⌘K"
- Editor reel: header con "siteId#propertyId · address" y fallbacks "—"
- Sample de variables: "2-bed apartment · Cranford Court" y "€385,000"
