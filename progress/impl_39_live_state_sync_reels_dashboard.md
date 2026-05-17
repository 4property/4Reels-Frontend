# Feature 39 — `live_state_sync_reels_dashboard_and_editor` (impl)

- **Agente:** Claude (rol implementer)
- **Fecha:** 2026-05-16
- **Estado:** lista para review (NO marcada `done` per contrato del implementer).
- **Cross-repo pair:** backend feature 39 (`test_reels_list_ordering_guard`) — el back ya ordena por `updated_at DESC` (verificado por contrato; este front no requiere cambios backend).

## 1. Resumen

Dos problemas combinados:

1. El Dashboard (`/reels`) no se invalida cuando el editor overlay muta un
   reel (photos, music, subtitles, slides, descriptions). El backend ya
   reordena por `updated_at DESC`, pero el front mantiene cache via `useApi`,
   así que el reel modificado no sube hasta un reload manual.
2. Las acciones Approve/Reject del Dashboard hacen refetch silencioso — sin
   spinner ni toast — y el usuario nunca confirma que la acción llegó.

Solución entregada:

- **Toaster global** (singleton + hook `useToast`) montado una vez en
  `<Shell>`. Cualquier código imperativo puede llamar
  `toast.success/error/info(msg, opts?)` sin estar dentro de un componente.
- **`DashboardRefetchContext`** que el editor consume con `useContext`. El
  `ReelsRoute` levanta el `refetch` del Dashboard via un `useRef` que el
  Dashboard publica via prop `onRegisterRefetch`. Cuando el editor se cierra
  TRAS al menos una mutación significativa, su `handleClose` dispara el
  `dashboardRefetch()` antes de navegar. Cero cambios en backend.
- Cada panel del editor (Photos, Music, Subtitles, Slides, Descriptions)
  recibe una nueva prop opcional `onMutate` y la llama tras un PATCH exitoso.
  El editor mantiene `hasMutatedRef.current = true` para decidir si pedir el
  refetch en el cierre.
- Approve/Reject (Dashboard + editor) ahora disparan toast de éxito/error.
  Los botones del card quedan deshabilitados visualmente (`disabled` +
  `aria-busy`) mientras la acción está in-flight a cualquier reel.

## 2. Archivos creados / modificados

### Creados (3)
- `src/lib/hooks/useToast.js` — singleton + hook `useToast()`. Export
  `toast` con `success/error/info/dismiss`. Auto-dismiss 4 s (success/info)
  / 6 s (error). Soporte `opts.id` para dedupe (reemplaza in-place y resetea
  el timer).
- `src/shared/Toaster.jsx` — renderer global. `role="status" aria-live="polite"`
  para success/info, `role="alert" aria-live="assertive"` para error. Botón
  de cierre por toast.
- `src/features/reels/DashboardRefetchContext.js` — `createContext(null)`
  consumido por el editor.
- `tests/reels_dashboard_live_sync.spec.js` — 3 specs × 3 viewports = 9
  E2E nuevos (refetch on close, toast success approve, toast error approve).

### Modificados (10)
- `src/shared/shared.css` — bloque `.toaster` + `.toast` + variantes
  `toast-success|error|info` + media query responsive < 720 px.
- `src/app/Shell.jsx` — monta `<Toaster />`, `ReelsRoute` ahora levanta el
  `refetch` del Dashboard via `useRef` + `registerRefetch` y envuelve el
  `<Outlet/>` con `<DashboardRefetchContext.Provider>`.
- `src/features/reels/Dashboard.jsx` — acepta prop `onRegisterRefetch`,
  publica su `refetch` via `useEffect`. `handleApprove`/`handleReject`
  envueltos en try/catch con `toast.success/error`. Estado local
  `pendingAction` + `actionInFlight` desactivan ambos botones globalmente
  durante la mutación.
- `src/features/reels/ReelCard.jsx` — props `disabled` y `pending`; añade
  `aria-busy` + `data-testid` (`reel-approve-${id}` / `reel-reject-${id}`).
- `src/features/reels/editor/ReelEditor.jsx` — consume
  `DashboardRefetchContext` con `useContext`; `hasMutatedRef` + `markMutated`;
  `handleClose` dispara `dashboardRefetch()` si mutó; pasa `onMutate` a cada
  panel. Approve/Reject inline también disparan toasts y marcan mutated.
- `src/features/reels/editor/useReelDebouncedOverride.js` — añade params
  `onMutated` y `onError`. `onMutated` se llama BEFORE el refetch (importa
  para el race "close inmediatamente después del PATCH"). `onError` se
  llama también en el path 409 LOCKED.
- `src/features/reels/editor/PhotosPanel.jsx` — prop `onMutate`,
  `onMutated`/`onError` al hook → toast.success / toast.error con id
  `reel-photos` (dedupe).
- `src/features/reels/editor/SubtitlesPanel.jsx` — idem (`reel-subtitles`).
- `src/features/reels/editor/SlidesPanel.jsx` — idem (`reel-slides`).
- `src/features/reels/editor/MusicOverridePanel.jsx` — prop `onMutate`;
  `handleChange` success → toast + `onMutate?.()`; `reportError` → toast.error
  (id `reel-music`).
- `src/features/reels/editor/DescriptionsPanel.jsx` — prop `onMutate`;
  `persist` success → toast.success + `onMutate?.()`; `reportError` →
  toast.error (id `reel-descriptions`).

(11 archivos modificados — `useReelDebouncedOverride.js` cuenta como uno; el
README/AGENTS/feature_list no se tocan.)

## 3. Decisiones no obvias

1. **Singleton vs Provider+Context para los toasts.** Elegí singleton
   (`let queue = []; let listeners = new Set()`) porque:
   - Permite emitir desde código no-React (p. ej. `lib/api/client.js` si
     mañana se centraliza el manejo de error).
   - Ergonomía imperativa: `toast.success('Saved')` lee mejor que
     `useToast().success('Saved')` en handlers.
   - El consumidor único de la cola es `<Toaster>` montado una vez en
     `<Shell>`; no necesitamos sub-árboles independientes que justifiquen
     un Provider.
   - Los tests del módulo (no creados aquí; hay un helper interno
     `__resetToastsForTests` documentado pero sin uso público) seguirán
     siendo triviales si en el futuro se añaden unitarios — sólo importar
     y resetear.

2. **Posición del Toaster: bottom-right.**
   - El editor overlay reserva la zona top-right para `StatusBadge`,
     `Approve & Publish`, `Reject`, etc. Un toast top-right colisionaría
     visualmente y se perdería bajo el header.
   - El Dashboard tiene el chip de count + filtros en la zona superior.
   - El estándar de "system notification" para web desktop es bottom-right
     (Slack, GitHub, Linear, etc.).
   - En viewports < 720 px (`tests/playwright` corre `tablet` 768×1024 y
     `mobile` 375×667) el bloque se extiende a casi todo el ancho y se
     queda abajo-centrado via media query, sin cambio de DOM.

3. **Levantar el `refetch` del Dashboard via `useRef` + `registerRefetch`
   en `ReelsRoute`.**
   El Dashboard ya tiene su `refetch` (de `useReels`). Para que el editor
   pueda invocarlo desde adentro del `<Outlet/>`, alguien tiene que
   colocarlo en un Context. Lo limpio es: el `ReelsRoute` (padre común)
   crea un `useRef(null)`, le pasa al Dashboard un `registerRefetch` para
   que apunte el ref, y envuelve el Outlet con un Provider cuyo `value` es
   una función estable `() => ref.current?.()`. Patrón:
   - 0 re-renders parásitos en el editor cuando el Dashboard refetchea
     (el Provider value es estable via `useCallback` con deps vacías).
   - El Dashboard se desuscribe en cleanup (`return () => onRegisterRefetch(null)`),
     evitando refetchs huérfanos si el Dashboard desmonta.
   - El editor permanece reusable como componente: si alguien lo monta
     fuera de `<DashboardRefetchContext.Provider>` (deep-link), el value
     es `null` y `handleClose` simplemente no llama al refetch — degrada
     graciosamente.

4. **`onMutated` vs `onMutate`.** El nombre `onMutated` (pasado al hook
   compartido `useReelDebouncedOverride`) se usa internamente y se invoca
   en el callback del flush. El nombre `onMutate` (pasado a las panels)
   es el prop público del editor — el panel decide cuándo dispararlo
   (siempre tras success). Mantiene la distinción semántica entre el
   evento del hook (PATCH-success) y la señal hacia el padre.

5. **Dedupe por `id` para los toasts de panels.** Cada panel usa un
   id estable (`reel-photos`, `reel-music`, `reel-subtitles`,
   `reel-slides`, `reel-descriptions`). Razón: el usuario puede disparar
   varios edits seguidos (e.g. drag tras drag) y queremos que el toast
   "Photos saved (re-rendering)" se reemplace en sitio en vez de apilar
   5 toasts idénticos. El backend ya colapsa los PATCH por debounce, pero
   panels como music/descriptions no debouncean — el dedupe del toast es
   la red de seguridad. Los toasts del Dashboard NO usan id (son
   distintos por reel + por acción → válido apilarlos si el usuario
   aprueba 3 reels seguidos).

6. **El toast se dispara ANTES del refetch del reel (panels) y ANTES del
   refetch del Dashboard (editor close).** Si el usuario cierra el editor
   inmediatamente después de un PATCH (race), `hasMutatedRef` debe quedar
   `true` antes del unmount. `onMutated` se llama síncronamente desde el
   flush exitoso del hook, sin esperar al refetch del reel.

7. **`pendingAction` global del Dashboard.** Cuando uno aprueba un reel,
   se desactivan TODOS los botones del grid, no sólo los de esa card.
   Razón: el `refetch` puede tardar 1–2 s y aceptar otros approve durante
   ese hueco arriesga race conditions visuales (un reel desaparece a
   mitad de click). El botón "in-flight" muestra `aria-busy="true"` y
   cambia su icono `check → clock` para feedback visual.

## 4. Verificaciones (las 6 obligatorias)

### 4.1 `npm run lint`
```
> 4reels@0.0.0 lint
> eslint .
```
(0 errores, 0 warnings)

### 4.2 `npm run build`
```
dist/assets/index-BYA_arSx.css                                  132.31 kB │ gzip:  31.53 kB
dist/assets/index-C0tFPACT.js                                   429.54 kB │ gzip: 123.44 kB
✓ built in 2.46s
```

### 4.3 `npm run test:e2e -- reels_dashboard_live_sync` (la spec nueva)
```
Running 9 tests using 4 workers
  ✓ 9 [desktop|tablet|mobile] × 3 specs (refetch on close, toast success, toast error)
  9 passed (11.5s)
```

### 4.4 `npm run test:smoke` (regression del subset crítico)
```
2 skipped
46 passed (36.7s)
```
(los 2 skipped son los pre-existentes `theme` en `flows.spec.js`)

### 4.5 `npm run test:e2e` (full)
```
1 failed
  [desktop] › tests/templates.spec.js:17:3 › feature 15 — templates tab › lists templates and switches the selected one
2 skipped
330 passed (2.1m)
```

La falla es **flaky pre-existente paralelismo**: re-ejecutada aislada
(`npx playwright test tests/templates.spec.js:17 --project=desktop`) →
**1 passed (676ms)**. Misma categoría documentada en `review_32/33/34/35/36/37`
(specs `social_templates.spec.js:19`, `social_templates.spec.js:233`,
`templates.spec.js:17`, `payload_contract.spec.js:20` rotan entre runs
bajo presión del `vite preview` con 4 workers). No causada por feature 39.

Baseline cross-check de specs editor que comparten panels modificados:
```
$ npx playwright test tests/per_reel_photos_override.spec.js \
    tests/per_reel_subtitles_override.spec.js \
    tests/per_reel_slides_override.spec.js \
    tests/reel_music_override.spec.js \
    tests/reel_descriptions_override.spec.js \
    tests/reel_approve_schedule.spec.js
  93 passed (53.4s)
```
Cero regresión en los panels que tocó esta feature (18 photos + 27
subtitles + 18 slides + 9 music + 18 descriptions + 3 approve_schedule
= 93 specs × varios viewports).

### 4.6 `bash ./init.sh`
```
[OK]    Sin TypeScript en src/
[OK]    package.json sin libs prohibidas
[OK]    lint verde
[OK]    build verde
[OK]    Entorno listo. Puedes empezar a trabajar.
```
exit 0.

## 5. Regression counts

| Suite                               | Baseline | Esta feature |
|-------------------------------------|---------:|-------------:|
| `npm run test:smoke`                | 46 / 2sk | 46 / 2sk     |
| Editor panel specs (photos+subs+slides+music+desc+approve) | 93 | **93** |
| Full `npm run test:e2e`             | 319+/3flake | **330 / 2sk / 1 flake (preexistente, isolated pass)** |
| Specs nuevas (`reels_dashboard_live_sync.spec.js`) | — | **9 (3 × 3 viewports)** |

Total adicional: **+9 specs** sin regresión.

## 6. Hard rules (chequeo final)

- ❌ TypeScript / React Query / MSW / Tailwind / styled-components / @emotion → ninguno introducido (init.sh sigue verde en check 4).
- ❌ Librerías nuevas → ninguna (diff de `package.json` vacío).
- ❌ `fetch` directo en componentes → no; los toasts no tocan red.
- ❌ `console.*` / `debugger` en producción → no (busqué).
- ❌ `VITE_*` secretos → no se añadieron variables de entorno.
- ✅ Sin TypeScript: archivos nuevos son `.js` / `.jsx`.
- ✅ Vanilla CSS: bloque de toaster en `src/shared/shared.css` (mismo bundle
  global que ya importa `styles/index.css` via la sección final del
  barrel). No CSS-in-JS, no Tailwind.
- ✅ Layer rules: `lib/hooks/useToast.js` no importa nada de arriba;
  `shared/Toaster.jsx` sólo importa de `lib/` y `shared/`; `features/reels/`
  consume el toast vía `lib/hooks/useToast.js` (import directo, no a través
  de un hook con dependencia de feature).
- ✅ Mock = spec: no se añadió endpoint nuevo → mock-backend no necesitó
  extensión. El test 1 redefine ad-hoc el handler de GET reels para forzar
  el re-ordenamiento esperado tras la mutación (back ya lo hace, el mock
  por defecto no reordena por updated_at — esto es aceptable porque el
  reordenamiento es responsabilidad backend y queda cubierto por el back
  feature 39 mirror).

## 7. Open items / nits no-bloqueantes

1. **`payload_contract.spec.js:20 [mobile]` y `templates.spec.js:17 [desktop]`
   y `social_templates.spec.js:233 [tablet]`** siguen siendo flakes
   paralelismo pre-existentes (mismas que arrastran reviews 32–37). No
   tocadas. Si el reviewer quiere bajarlas, propongo `workers: 2` para
   `npm run test:e2e` en `playwright.config.js` — fuera de scope feature 39.
2. **Toast unit tests.** El módulo `useToast.js` expone
   `__resetToastsForTests` documentado para futuras unit tests con Vitest.
   No hay infraestructura Vitest en el repo todavía (sólo Playwright);
   añadirla es decisión del leader.
3. **i18n.** Los toasts están en inglés ("Reel approved", "Photos saved
   (re-rendering)") consistente con el resto del UI. El editor tiene una
   cadena en español aislada (`"La pista no se puede cambiar..."` en
   MusicOverridePanel) que ya estaba; no la toqué.
4. **Approve desde el EDITOR** también marca mutated y dispara el refetch
   en cierre — esto significa que aprobar desde el editor reordena
   correctamente el Dashboard. (Documentado en `handleApprove` de
   `ReelEditor.jsx`.)
5. **Cualquier flujo futuro que añada PATCH dentro del editor** debe (a)
   aceptar prop `onMutate`, (b) llamarla tras success. Si usa
   `useReelDebouncedOverride`, basta con pasar `onMutated`. Patrón
   consistente con los 5 panels existentes.

## 8. Próximos pasos

- Reviewer ejecuta `./init.sh`, `npm run test:e2e -- reels_dashboard_live_sync`,
  `npm run test:smoke`. Si verde, marca `done` en `feature_list.json`.
- Manual QA contra `:8001` cuando el reviewer apruebe:
  1. `/reels` → identificar reel en posición ≥ 3.
  2. Abrir editor → cambiar música → verificar toast "Music override saved".
  3. Cerrar editor con "Back to reels".
  4. Comprobar que el reel modificado está ahora en posición 1 sin reload.
  5. Approve desde Dashboard → toast verde con título del reel.
  6. (Opcional) Inducir un 500 del back en approve → toast rojo aparece.
