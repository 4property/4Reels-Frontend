# Review — ReelCard address + price stack

**Veredicto:** APPROVED

## Checkpoints

- C1 (reorder correcto en `ReelCard.jsx`): [x]
  `src/features/reels/ReelCard.jsx:46-51` — dentro de `.reel-card-head`
  hay un solo hijo `.min-w-0.grow` con el orden vertical
  título → dirección → precio. El precio ya no se renderiza fuera de
  esa columna.
- C2 (formateo consistente, sin doble formato): [x]
  `reel.price` se construye en `src/features/reels/hooks.js:92` como
  `item.price || ''` (string ya formateado del backend, p. ej.
  `'€385,000'`). El JSX lo renderiza verbatim con
  `{reel.price}`. No hay `Intl.NumberFormat` ni transformación
  duplicada.
- C3 (no rompe `ReelsTable.jsx` ni otras vistas): [x]
  `grep -rn "reel-card-price\|reel-card-address\|reel-card-head"` en
  `src/` y `tests/` solo arroja matches en `ReelCard.jsx` y
  `reels.css`. `ReelsTable.jsx` no usa esas clases.
- C4 (`npm run lint` y `npm run build` verdes): [x]
  Lint: exit 0, sin output. Build: `built in 2.31s`,
  `dist/assets/index-*.css 118.23 kB`, sin warnings.
- C5 (ARCHITECTURE / DOCS / CLAUDE): [x]
  No se añaden dependencias. Solo se tocan
  `src/features/reels/ReelCard.jsx` y `src/features/reels/reels.css`
  (ambos dentro del scope de la feature). Sin `console.log`,
  `debugger`, ni `fetch` directo. Sigue las capas
  (componente → hook → mock).

## Notas menores (no bloqueantes)

- `.reel-card-head` mantiene `display: flex` +
  `justify-content: space-between` aunque ahora tiene un único hijo.
  El implementer lo justifica como hook para un futuro slot derecho
  (status chip). Aceptable, pero si en la próxima feature no se
  necesita, conviene simplificarlo a un bloque normal.
- Guarda `reel.price ? ... : null` correcta para evitar nodo vacío
  con `margin-top`.
