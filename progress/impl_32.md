# Feature 32 — reels_list_pagination_and_filters_ui (implementer report)

**Status:** ready for reviewer. Feature kept in `in_progress` per the leader's instruction (do NOT mark `done`).

**Backend counterpart:** `/opt/projects/4Reels-Backend` feature 32 — implemented in parallel; this implementation uses the mock backend (`tests/support/mock-backend.js`) as spec. When the real back deploys to `:8001` and returns the same shape (`{items, count_total, page, page_size, has_more, count}`), the UI works without further changes.

## 1. Files touched

| File                                                       | Type             | Notes |
|------------------------------------------------------------|------------------|-------|
| `src/features/reels/api.js`                                | api              | `reelsApi.list` ahora acepta `{agencyId, page, pageSize, workflowState, publishStatus, q}` y construye query con sólo los params definidos. Legacy positional signature (`list(agencyId)`) sigue funcionando para backcompat. |
| `src/features/reels/hooks.js`                              | hook             | `useReels({...})` acepta filtros + paginación; expone `{ reels, countTotal, page, pageSize, hasMore, loading, error, refetch, agencyId }`. Sin args mantiene el comportamiento previo (primera página, sin filtros). |
| `src/features/reels/Dashboard.jsx`                         | component        | Reescrito: URL state vía `useSearchParams` de `react-router-dom`, debounce search 300ms (local mirror), dropdowns `workflow_state` + `publish_status`, paginación `‹ Showing A–B of N ›`, dropdown `page_size` (10/25/50, default 25), skeleton sólo en el body, empty state diferenciado (legacy "No reels yet" cuando no hay filtros, "No reels match the current filters" cuando sí). Los shortcut tabs (`All / Needs approval / Published / Rejected`) ahora son atajos sobre el filter `publish_status` y se derivan del URL state (sin perder el subtab visual). |
| `src/features/reels/reels.css`                             | css              | Estilos para `.reels-filter`, `.reels-pagination`, `.reels-skeleton-card/row`, `.reels-empty`. Métricas pasan de `repeat(4, 1fr)` a `repeat(auto-fit, minmax(220px, 1fr))` porque sólo hay una tarjeta ahora. Skeleton shimmer respeta `prefers-reduced-motion`. |
| `tests/support/mock-backend.js`                            | mock handler     | `GET .../reels` ahora parsea `page`, `page_size`, `workflow_state`, `publish_status`, `q` y devuelve `{items, count_total, page, page_size, has_more, count}`. `q` busca en title + slug + source_property_id. `workflow_state` / `publish_status` aceptan CSV. Añadidos helpers `parseCsv` y `parsePositiveInt`. |
| `tests/reels_list_pagination.spec.js`                      | test (new)       | 6 specs × 3 viewports = 18 tests. Ver §3. |
| `DOCS.md`                                                  | docs             | Añadida sección "Reels list pagination + filters" en `## Backend contract`. |
| `feature_list.json`                                        | meta             | Feature 32 status `pending` → `in_progress`. |
| `progress/current.md`                                      | meta             | Bloque nuevo de la sesión. |

## 2. Mock handler changes (diff summary)

Resumen del cambio en `tests/support/mock-backend.js` (`GET /v1/admin/agencies/{id}/reels`):

```
- return route.fulfill(jsonResponse({ items, count: items.length }));
+ // Parse ?page=&page_size=&workflow_state=&publish_status=&q=
+ // Filter by workflow_state (CSV), publish_status (CSV), and q (title/slug/source_property_id).
+ // Paginate; return { items, count_total, page, page_size, has_more, count }.
+ return route.fulfill(jsonResponse({
+   items: slice,
+   count_total: countTotal,
+   page,
+   page_size: pageSize,
+   has_more: hasMore,
+   count: slice.length, // legacy alias
+ }));
```

Helpers nuevos (al lado de `extractAgencyId`):

```js
function parseCsv(value)               // 'a,b,c' → ['a','b','c']
function parsePositiveInt(value, fb)   // 'NaN' → fb
```

## 3. Tests added

`tests/reels_list_pagination.spec.js` cubre los criterios de acceptance:

| Test | Cubre |
|---|---|
| renders pagination, filters and table without console errors | Smoke (acceptance §1, §3) |
| navigates page 1 → 2 and updates the table | Page nav dispara nueva request con `page=2` (acceptance §4) |
| workflow_state filter filters server-side and resets to page 1 | Filter reset rule (acceptance §4) + URL refleja (acceptance §5) |
| search input is debounced and reflects in the URL | Debounce 300ms (acceptance §6) + URL persistence (acceptance §5) |
| reloading ?page=2&page_size=10&q=cranford reproduces the state | URL state reload (acceptance §5) |
| empty state appears when count_total is 0 (distinct from loading) | Empty vs loading diferenciados (acceptance §7) |

Cada test corre en 3 viewports (desktop / tablet / mobile) por `playwright.config.js`. Total: 18.

## 4. Verification output

### `./init.sh`
```
── 5. Lint ─────────────────────────────────────────────
[OK]    lint verde
── 6. Build ────────────────────────────────────────────
[OK]    build verde
── 7. Resumen ──────────────────────────────────────────
[OK]    Entorno listo.
```
Exit code 0. CSS final: 128.11 kB (gzip 30.96). JS final: 406.14 kB (gzip 116.56).

### `npm run test:smoke`
```
46 passed (36.3s)
2 skipped     (los `theme` preexistentes en viewports mobile/tablet)
0 failed
```

### `npm run test:e2e`
```
214 passed (1.4m)
2 skipped     (los `theme` preexistentes)
0 failed
```

Las 18 nuevas specs (3 viewports × 6 escenarios) pasan en verde. Smoke `/reels` sigue verde. Specs preexistentes que tocan `/reels` (flows.spec.js, ghl_context.spec.js, reel_approve_schedule.spec.js, reel_descriptions_override.spec.js, reel_music_override.spec.js, automation_scheduling.spec.js) siguen verdes — la nueva forma `{items, count_total, page, page_size, has_more, count}` mantiene `count` como alias legacy y `items` como la key principal.

## 5. Open items for reviewer

1. **URL state pattern**: no había patrón previo en repo para state en URL search params (grep negativo en `useSearchParams`/`URLSearchParams` fuera de `ghlMvpContext.js`). Usé `useSearchParams` de `react-router-dom@6.28` que ya está en `dependencies`. Si quieres un helper compartido en `src/lib/hooks/` para futuros tabs / filters, dilo y lo extraigo — no me adelanté para mantener scope acotado.
2. **Métricas en cabecera**: antes había 4 tarjetas (`Total / Published / Needs approval / Rejected`) calculadas client-side desde `reels`. Con paginación server-side ya no podemos derivarlas sin N requests adicionales. Reducí a 1 tarjeta ("Total reels (current view)") que muestra `count_total` del filtro actual. Esto es estable contra cambios de página (no parpadea) y semántico contra cambios de filtro (cambia, lo cual es correcto). Si prefieres conservar las 4 métricas, hay que añadir un endpoint `GET .../reels/counts` o un side-by-side `count_by_publish_status` en la propia respuesta. Documento la decisión aquí; lo dejo para una feature aparte.
3. **Shortcut tabs**: conservé los 4 subtabs (`All / Needs approval / Published / Rejected`) como atajos visuales sobre el filter `publish_status`. Active state se deriva del URL. Quité los `(N)` count badges por la misma razón que el punto 2. Si los quieres, mismo dependency: un endpoint de counts.
4. **`<input type="search">`**: usé `type="search"` para que el browser ofrezca su botón de "clear" nativo. Si prefieres `type="text"` para uniformidad con el resto del repo (que usa `text` en su mayoría), cambio una palabra.
5. **`useApi` no es cache layer**: al cambiar filtro/página el spinner se muestra brevemente (skeleton sólo en body). `data` no se nulea durante el fetch así que las filas anteriores siguen visibles hasta que llega la nueva tanda — eso es UX buena (no flicker). El countTotal sí se mantiene "estable" con un `stableTotal` (ref) para no caer a 0 mid-fetch. Reviewer puede preferir incluso bloquear el botón Next mientras `loading`; hoy es clicable. Si lo quieres bloqueado decírmelo.
6. **`workflow_state` valores**: usé `pending / needs_approval / awaiting_review / approved / rejected / published / failed`. Mapean a lo que vi en `publishStatus.js` y en `mock-backend.js`. Si el back de feature 32 emite otros valores (e.g. `processing`, `enqueued`), añadirlos al dropdown es un append-only edit en `WORKFLOW_STATE_OPTIONS`.

## 6. Manual QA checklist vs `:8001`

Cuando deployes el back de feature 32 en `:8001`:

1. Abrir `/reels` en una agency con > 25 reels. Confirmar:
   - El subtítulo del card del header dice "X total" donde X = `count_total` (no `len(items)`).
   - La pagination summary dice "Showing 1–25 of X" (X = `count_total`).
   - El botón Next está activo si `has_more=true`; deshabilitado si no.
2. Pulsar Next → URL → `?page=2`, el back recibe `?page=2&page_size=25`, la tabla muestra items 26–50.
3. Cambiar el dropdown "Rows per page" a 10 → URL → `?page_size=10`, page vuelve a 1, summary "1–10 of X".
4. Seleccionar `workflow_state=needs_approval` en el dropdown → URL → `&workflow_state=needs_approval`, page vuelve a 1, sólo reels con ese workflow_state.
5. Escribir "cranford" en el search → tras 300ms → URL → `&q=cranford`, sólo reels con ese término (title, slug o source_property_id).
6. Recargar `/reels?page=2&page_size=10&workflow_state=needs_approval&q=cranford` → la página entra ya filtrada/paginada (dropdowns + summary + tabla reflejan el URL state).
7. Botón atrás del browser deshace el último filtro / página (URL state ↔ browser history).
8. En DevTools Network: ningún request con `?page=` se dispara por keystroke individual (solo 1 al final del debounce).
9. Si el back devuelve `{items, count}` (legacy, sin `count_total`), la UI cae a `items.length` → la summary diría "Showing 1–N of N" para una sola página. Eso es backcompat correcto.

## Decisiones no obvias

- **No instalé librerías nuevas.** `useSearchParams` ya viene con `react-router-dom@6.28`.
- **No introduje TypeScript / React Query / MSW.** El hook es vanilla JS sobre `useApi`.
- **No toqué `useApi`.** Mantengo su contrato (`data, loading, error, refetch`) intacto para no impactar otros features.
- **El handler mock devuelve `count` además de `count_total`.** Es alias legacy explícito en la spec del leader — si en un futuro el back lo retira, ningún consumidor frontend se rompe (nadie lo lee).
