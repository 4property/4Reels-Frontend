# impl 11 — `unescape_html_entities_everywhere`

## Resumen

Anadida una utilidad pura `decodeHtmlEntities(str)` en `src/shared/`
que decodifica entidades HTML numericas (decimales y hexadecimales) y
un set pequeno de entidades nombradas (`&amp;`, `&lt;`, `&gt;`,
`&quot;`, `&apos;`, `&nbsp;`). Aplicada en las cuatro vistas que
pintaban `title` crudo de WordPress (`title.rendered`) y en el filtro
de busqueda del Dashboard, para que el usuario vea `Jacob's Island`
en lugar de `Jacob&#8217;s Island`.

## Archivos creados/modificados

| Archivo | Tipo | Motivo |
|---|---|---|
| `src/shared/decodeHtmlEntities.js` | nuevo (shared util) | Decodificador puro string→string |
| `tests/unit/decodeHtmlEntities.unit.js` | nuevo (unit test) | 15 casos via `node --test` |
| `src/features/reels/ReelCard.jsx` | modificado (component) | Decodifica `reel.title` antes de pintar (titulo + label de `<Cover>`) |
| `src/features/reels/ReelsTable.jsx` | modificado (component) | Decodifica `r.title` por fila (titulo + label de `<Cover>`) |
| `src/features/reels/editor/ReelEditor.jsx` | modificado (component) | Decodifica solo la linea `editor-header-title`; NO toca approve / idempotency |
| `src/features/reels/Dashboard.jsx` | modificado (component) | El filtro de busqueda compara titulo decodificado |
| `feature_list.json` | edit | Feature 11 → `in_progress` |
| `progress/current.md` | edit | Header de sesion + plan + decisiones |

## Decision tecnica: regex + tabla, no DOMParser

Elegida la opcion (b) recomendada en el brief y en `CLAUDE.md`:
implementacion vanilla con regex + tabla pequena de named entities,
sin `DOMParser`.

Razones:
1. `DOMParser` no existe en Node `--test`. Usarlo obligaria a anadir
   `jsdom` o `linkedom` como dep. El `CLAUDE.md` prohibe instalar
   libs nuevas sin permiso del leader.
2. La utilidad es pura: tests sin browser ni harness, idempotente,
   facilmente extensible si aparece otra entidad nombrada.
3. WordPress emite tipicamente solo: `&#8217;` (right single quote),
   `&#8216;`, `&amp;`, `&#039;`, `&quot;`, `&ndash;`/`&mdash;` (via
   numericas), `&hellip;`. Todas cubiertas por el decodificador
   numerico + la tabla.

Detalles del decoder:
- Regex unico: `/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi` (case-insensitive).
- Numericas: `parseInt(decimal/16)` + `String.fromCodePoint()` con
  guarda para codepoints fuera de rango `[0, 0x10FFFF]`.
- Nombradas: tabla `NAMED_ENTITIES`, lookup `.toLowerCase()`.
- Entidad desconocida → se devuelve verbatim (la entrada queda
  intacta, evita perder texto).
- Tipo no-string o vacio → devuelve la entrada tal cual.
- `&nbsp;` mapea a U+00A0 (non-breaking space real), no a ASCII 0x20.
- Una sola pasada (idempotente para input ya decodificado, NO
  resuelve doble encoding como `&amp;#8217;` en una sola pasada — el
  test explicita ese comportamiento; correr la funcion dos veces lo
  resolveria si llega a ser necesario).

## Output de la verificacion

### `node --test tests/unit/decodeHtmlEntities.unit.js`

```
ℹ tests 15
ℹ suites 0
ℹ pass 15
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ~110
```

Cobertura de casos:
1. Numerica decimal `&#8217;`
2. Named `&amp;`
3. Named `&lt;`/`&gt;`
4. Named `&quot;`
5. Named `&apos;` + numerica `&#039;`
6. Hexadecimal `&#x2014;`
7. Multiples entidades mezcladas en una cadena
8. Cadena sin entidades (identity)
9. Inputs defensivos: empty / null / undefined / numero
10. Una sola pasada (double-encoded queda parcialmente)
11. Entidad nombrada desconocida (verbatim)
12. Astral plane via numerica (`&#128512;` → emoji)
13. `&nbsp;` → U+00A0
14. Case-insensitive (`&AMP;`, `&LT;`)
15. Numerica fuera de rango → verbatim

### `npm run lint`

```
> 4reels@0.0.0 lint
> eslint .
```

Sin warnings ni errores.

### `npm run build`

```
✓ built in 2.21s
dist/assets/index-EiCWwArL.js   364.88 kB │ gzip: 104.67 kB
```

### `npm run test:smoke`

```
43 passed, 2 skipped (1.0m)
```

Los 2 skipped son los habituales `theme › flips the data-theme
attribute` en tablet/mobile (no relacionados con esta feature).

## Comprobacion de acceptance

- [x] `src/shared/decodeHtmlEntities.js` exporta funcion pura
      `decodeHtmlEntities(s)` con 15 tests unitarios (>=10).
- [x] Los 4 componentes citados muestran `Jacob's Island` en lugar
      de `Jacob&#8217;s Island`:
  - `ReelCard.jsx:46` → ahora `{title}` decodificado.
  - `ReelsTable.jsx:48` → ahora `{title}` decodificado (variable
    local por fila).
  - `ReelEditor.jsx:317` (header title) → ahora
    `{decodeHtmlEntities(reel.title)}`.
  - `Dashboard.jsx:28` (busqueda) → ahora compara haystack
    decodificada.

## Decisiones no obvias

- **Importacion no usada para el label de `Cover`**: aproveche que
  ya existia un import del titulo para pasarle tambien la version
  decodificada a `<Cover label={...}>`. `label` se usa como
  `aria-label`/alt fallback en `Cover.jsx`, asi que es mejor que
  llegue decodificado (lectores de pantalla no leen `&#8217;`).
- **`Dashboard.jsx` solo decodifica para busqueda, no muta `r.title`**:
  el filtro de busqueda compara strings decodificados (asi un
  usuario que escribe `Jacob's` encuentra `Jacob&#8217;s Island`),
  pero la lista pasa el reel intacto a `ReelCard` / `ReelsTable`,
  que ya saben decodificar. Se evita decodificar dos veces.
- **`ReelEditor.jsx`**: SOLO se ha cambiado la linea
  `editor-header-title` (la pintada del titulo). No se ha tocado
  el approve idempotency ni el anti-doble-click ni nada de la
  ventana de aprobacion.
- **Working tree preexistente**: Pinterest cerrada, session
  `decryptErrorKind`, `publishStatus`, ReelEditor idempotency,
  LICENSE — todos esos cambios se mantienen intactos. Mi diff se
  suma encima.

## Endpoints anadidos al mock

Ninguno. La feature es 100% cliente, transforma strings que ya vienen
del backend.

## Cambios en `DOCS.md`

Ninguno. El contrato backend no cambia.

## Estado

Pendiente revision por el agente reviewer. NO marcado `done`.
