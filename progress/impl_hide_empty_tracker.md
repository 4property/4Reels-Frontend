# impl: hide empty TrackerStats

## Decisión

Modificado **a nivel del componente** `TrackerStats.jsx` para que
retorne `null` cuando no hay datos de tracker. Justificación:

- `TrackerStats` solo se usa en un sitio (`ReelCard.jsx:96`); no hay
  otros consumidores donde el mensaje "No tracker data yet" tuviera
  sentido.
- `ReelsTable.jsx` ya maneja su propio vacío (`—`) sin usar
  `TrackerStats`, por lo que centralizar la lógica en el componente
  es lo más limpio.
- Cambiar a nivel del componente evita duplicar el chequeo en cada
  futuro consumidor.

## Definición de "no hay datos"

Según el shape real (`src/features/reels/hooks.js` define `tracker: null`
para el estado inicial; el mock backend lo rellena con
`{views, clicks, ctr, clicks7d, clicks30d, topNet}`):

`hasData` es `true` si `tracker` es objeto y al menos uno de:
- `views`, `clicks` o `ctr` están definidos (no `null`/`undefined`)
- `clicks7d` o `clicks30d` son arrays no vacíos

En caso contrario, `null`/`undefined`/`{}` u objeto sin métricas →
no se renderiza nada.

## Archivos tocados

- `src/features/reels/TrackerStats.jsx` (component): sustituido el
  bloque de fallback `<div className="tracker-empty">…</div>` por
  `return null` tras chequeo `hasData`. Eliminado import de `Icon`
  (ya no se usa).

No se tocó CSS ni `ReelCard.jsx`. La clase `.tracker-empty` queda
huérfana en `reels.css` pero no se elimina (fuera de scope; puede
limpiarse en una pasada futura de CSS).

## Verificación

```
npm run lint  -> OK (sin warnings)
npm run build -> OK (built in 2.63s)
```

Tests existentes no afectados: ningún test referencia el string
"No tracker data yet" ni la clase `tracker-empty`.
