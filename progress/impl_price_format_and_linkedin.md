# Implementación: Formato de precio en ReelCard + LinkedIn en networks

Fecha: 2026-05-13
Contexto previo: `progress/explore_price_and_socialdot.md`

## Archivos modificados

- `src/features/reels/ReelCard.jsx` (component)
  - Añadido helper local `formatReelPrice(price, kind)`:
    - Retorna `''` si el precio es vacío/null/no string.
    - Si el string no empieza con un símbolo de moneda conocido
      (`€`, `$`, `£`, `¥`, `₹`, o prefijos `EUR/USD/GBP/CA$/A$`),
      antepone `€`.
    - Si `kind` contiene `'let'` (alquiler: `'to-let'`, `'let-agreed'`,
      `'let'`), añade sufijo ` /month`.
  - Computa `priceLabel` antes del render y lo usa en
    `<div className="reel-card-price">`.

- `src/features/reels/hooks.js` (hook / adapter)
  - `parseNetworksFromPipeline()` ahora devuelve
    `['instagram', 'tiktok', 'facebook', 'linkedin']` cuando
    `publish_status === 'published'`. Con esto LinkedIn vuelve a
    renderizarse en `ReelCard` / `ReelsTable` aprovechando el mapeo
    correcto que ya existía en `useSocials()` y `socialMap`.

## Decisiones no obvias

- Helper inline (no `shared/`) porque la lógica es muy específica de
  la tarjeta y mezcla precio + tipo de listing; sacarla a `shared/`
  añadiría acoplamiento sin reutilizadores reales hoy.
- La detección de "tiene símbolo" es permisiva (5 símbolos comunes +
  códigos ISO en prefijo) para no doblar el `€` si el backend ya
  envía uno; no normaliza posición ni separadores (eso es trabajo
  de `formatPriceSample()` en defaults, no de la tarjeta).
- LinkedIn se añade al hardcoded igual que el resto. El fix robusto
  (que el backend mande `published_to`) queda fuera de scope.

## Verificaciones

- `npm run lint` → limpio (sin output de errores).
- `npm run build` → `✓ built in 2.28s`, bundle sin warnings.
- `npm run test:smoke` → `43 passed, 2 skipped` (los 2 skipped son
  los `theme › flips the data-theme attribute` preexistentes).

Tests existentes que cargan reels con `price: '€385,000'`
(`tests/flows.spec.js`, `tests/reel_approve_schedule.spec.js`) no
asertaban el string exacto, así que siguen verdes pese a que el
sufijo ` /month` aparecería si el fixture fuese alquiler (los
fixtures usados son `for-sale`).
