# Review — hide_empty_tracker

**Veredicto:** APPROVED

## Checkpoints
- C1 Stack (.jsx, no TS): [x]
- C2 Layer rules (no fetch directo, sin cruces de capas): [x] — solo cambio en `src/features/reels/TrackerStats.jsx`.
- C3 Dependencias (sin blocklist): [x] — no se añade nada.
- C4 Convenciones (PascalCase, hooks, kebab CSS): [x].
- C5 Mock backend / contrato: [x] — el shape `{views, clicks, ctr, clicks7d, clicks30d, topNet}` coincide con `tests/support/mock-backend.js` y `useReels` (`tracker: null` inicial).
- C6 Sin `console.log` / `debugger`: [x].
- C7 Lint: [x] (`npm run lint` limpio).
- C8 Build: [x] (`npm run build` OK en 2.31s).
- C9 Otros consumidores: [x] — `grep -rn "TrackerStats"` confirma único consumidor `ReelCard.jsx:96`. `ReelsTable.jsx` gestiona su propio `—` sin usar `TrackerStats`.
- C10 Cobertura del caso (`reel.tracker` nulo/objeto vacío/objeto sin métricas): [x] — `hasData` cubre los tres correctamente y devuelve `null` (no renderiza nada).

## Notas
- La clase CSS `.tracker-empty` queda huérfana en `src/features/reels/reels.css:222`. Documentado por el implementer como limpieza futura; aceptable, no bloquea.
- No hay tests E2E que cubran explícitamente "reel sin tracker"; el cambio es defensivo y no rompe selectores existentes (ningún test referenciaba `.tracker-empty` ni "No tracker data yet").
