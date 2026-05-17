# Review — price format in ReelCard + LinkedIn in networks

**Veredicto:** APPROVED

## Checkpoints
- C1 (stack: `.jsx` / `.js`, no TS): [x]
- C2 (layer rules, no `fetch` directo en componentes): [x] `ReelCard`
  sigue siendo presentación; `parseNetworksFromPipeline` vive en
  `features/reels/hooks.js`.
- C3 (no nuevas deps del blocklist): [x] `package.json` sin cambios.
- C4 (convenciones de nombres / estilo): [x] helper local
  `formatReelPrice` en camelCase, sin export innecesario.
- C5 (no `console.*` ni `debugger` residuales): [x]
- C6 (lint/build/tests verdes): [x]
  - `npm run lint` → limpio.
  - `npm run build` → `built in 2.26s`, sin warnings.
  - `npm run test:smoke` → 43 passed, 2 skipped (los preexistentes
    `theme › flips the data-theme attribute`).

## Validación funcional

1. **Precio con `€` y sufijo ` /month`** — `src/features/reels/ReelCard.jsx:17-24`
   - `formatReelPrice('385,000', 'for-sale')` → `'€385,000'` (antepone `€`).
   - `formatReelPrice('€2,500', 'to-let')` → `'€2,500 /month'` (no duplica `€`).
   - `formatReelPrice('£1,200', 'let-agreed')` → `'£1,200 /month'`
     (respeta símbolo existente, añade sufijo por `kind.includes('let')`).
   - `formatReelPrice('', x)` → `''` (no renderiza la línea, ver línea 66).
   - La detección de moneda usa `/^\s*[€$£¥₹]/` + prefijos ISO
     (`EUR/USD/GBP/CA$/A$`); razonable para el contrato actual del
     backend que normalmente entrega strings tipo `'€385,000'` o
     `'385000'`.
   - `reel.kind` viene de `classifyKind()` en `hooks.js:119-127`, que
     produce `'to-let'` o `'let-agreed'` para alquileres — ambos
     contienen `'let'`, así que el sufijo se aplica correctamente.
     `'sale-agreed'` también contiene la substring `'ale'` pero NO
     `'let'`, así que no hay falso positivo. `'sold'`, `'for-sale'`
     tampoco lo contienen. OK.

2. **LinkedIn en networks** — `src/features/reels/hooks.js:114-117`
   - `parseNetworksFromPipeline()` retorna
     `['instagram','tiktok','facebook','linkedin']` cuando
     `publish_status === 'published'`. `useSocials()` + `socialMap` en
     `ReelCard.jsx:28-29` ya mapea `'linkedin'` al `SocialDot`
     correspondiente, así que el dot aparecerá sin trabajo extra.

## Scope

`git diff --stat` confirma que solo se han tocado los dos archivos
listados en el informe: `ReelCard.jsx` (+29/-3) y `hooks.js` (+1/-1
neto para la network; el bloque `mapPublishStatus` movido a
`./publishStatus.js` corresponde a la feature 14 ya cerrada y no a
este cambio). Sin colaterales.

## Observaciones (no bloquean)

- El helper `formatReelPrice` está inline en `ReelCard.jsx`. Si en el
  futuro `ReelsTable` necesita el mismo formato, conviene moverlo a
  `src/features/reels/formatPrice.js` o `shared/`. Hoy no hay
  reusadores, así que la decisión del implementer es correcta.
- El hardcode de `linkedin` en `parseNetworksFromPipeline` es deuda
  conocida (TODO documentado en el informe: el backend debería mandar
  `published_to`). Fuera de scope.
