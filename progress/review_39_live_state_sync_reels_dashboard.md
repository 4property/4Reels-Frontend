# Review — feature 39 (`live_state_sync_reels_dashboard_and_editor`)

- **Reviewer:** Claude (rol leader → reviewer pass)
- **Fecha:** 2026-05-16
- **Implementer report:** `progress/impl_39_live_state_sync_reels_dashboard.md`

**Veredicto:** APPROVED

## 1. Resumen ejecutivo

El implementer entrega un Toaster global vanilla (singleton + hook) montado
en `<Shell>`, un `DashboardRefetchContext` que el editor consume para
disparar `refetch()` del Dashboard en el `handleClose` solo cuando
`hasMutatedRef.current === true`, y propaga la señal `onMutate` por los
cinco paneles (`PhotosPanel`, `SubtitlesPanel`, `SlidesPanel`,
`MusicOverridePanel`, `DescriptionsPanel`) — además de los handlers
inline `handleApprove`/`handleReject` tanto en Dashboard como en el
header del editor. Approve/Reject ahora producen feedback inmediato via
`toast.success`/`toast.error`, y el grid se bloquea globalmente con
`actionInFlight` mientras un POST está in-flight.

Las nueve specs nuevas (`tests/reels_dashboard_live_sync.spec.js`, 3
escenarios × 3 viewports) pasan; lint + build + smoke + full e2e verdes
salvo el flake conocido de paralellismo (`social_templates.spec.js:19
[desktop]`, isolated-pass confirmado por el reviewer). `init.sh` exit 0.

## 2. Checkpoints

- **C1 (Toaster vanilla + montado en Shell):** [x]
  - `src/lib/hooks/useToast.js:32-129` — singleton (`queue`, `listeners`,
    `timers`), `toast.success/error/info/dismiss` invocable fuera de
    React, hook `useToast()` con resync on mount (`:113`) que evita
    perderse toasts emitidos antes del subscribe del `<Toaster>`.
  - `src/shared/Toaster.jsx:30-69` — `role="status" aria-live="polite"`
    para success/info, `role="alert" aria-live="assertive"` para error
    (`:43-44`), botón de cierre con `aria-label`.
  - `src/app/Shell.jsx:117` — montado UNA vez fuera de las `<Routes>`,
    aparece en todas las páginas.
  - Auto-dismiss configurable (`DEFAULT_DURATION = {success:4000,
    info:4000, error:6000}` en `useToast.js:37-41`, override via
    `opts.duration` en `:64-67`).
  - Dedupe por `opts.id` funcional: `useToast.js:74-81` reemplaza in-place
    y resetea el timer (`scheduleDismiss` en `:49-60`).

- **C2 (DashboardRefetchContext + lifting limpio):** [x]
  - `src/features/reels/DashboardRefetchContext.js:17` —
    `createContext(null)`. Default `null` permite degradación graciosa
    cuando el editor se monta fuera de `/reels` (deep-link).
  - `src/app/Shell.jsx:141-161` — `ReelsRoute` mantiene un `useRef` y
    expone `dashboardRefetch` estable via `useCallback([], [])`. El
    Provider envuelve sólo el `<Outlet/>` (editor), no el Dashboard, así
    que el Dashboard no se re-renderiza cuando el editor consume.
  - `src/features/reels/Dashboard.jsx:146-150` — el Dashboard publica su
    `refetch` y se desuscribe en cleanup (`return () =>
    onRegisterRefetch(null)`), correcto.

- **C3 (tracking `hasMutated` en el editor):** [x]
  - `src/features/reels/editor/ReelEditor.jsx:119-123` — `useRef(false)`
    + `markMutated` estable.
  - `:124-137` — `handleClose` chequea `hasMutatedRef.current` Y la
    función del contexto antes de invocarla; el try/catch defensivo evita
    que un fallo del refetch del Dashboard rompa el cierre del editor.
  - `markMutated` se pasa como `onMutate` prop a los cinco paneles
    (`:303, :331, :343, :351, :362`).
  - `handleApprove`/`handleReject` del editor también llaman
    `markMutated()` después del `await approve(...)` exitoso
    (`:239, :262`), tal como pide la regla 4 del Open Items del
    implementer.

- **C4 (onMutate llamado tras success en cada panel):** [x]
  - `PhotosPanel.jsx:82-87` — `onMutated` (al hook) y `onError` ramifican
    a `toast.success('Photos saved (re-rendering)', {id:'reel-photos'})`
    y `onMutate?.()`.
  - `SubtitlesPanel.jsx:118-123` — idem (`reel-subtitles`).
  - `SlidesPanel.jsx:122-127` — idem (`reel-slides`).
  - `MusicOverridePanel.jsx:65, 83-86` — `toast.error` en `reportError`,
    `toast.success` + `onMutate?.()` tras PATCH (`reel-music`).
  - `DescriptionsPanel.jsx:105, 144-146` — `toast.error` en
    `reportError`, `toast.success` + `onMutate?.()` tras persist exitoso
    (`reel-descriptions`).
  - `useReelDebouncedOverride.js:118-128` — `onMutated` se invoca ANTES
    del `await refetchReel()`, eliminando el race "cierro inmediatamente
    tras editar". Try/catch defensivo (`:123-127`) evita que un fallo en
    el toast rompa el loop.
  - `:142-144, :150-152` — `onError` también se llama en el path 409
    LOCKED, no sólo en errores genéricos.

- **C5 (feedback Dashboard approve/reject + lock):** [x]
  - `Dashboard.jsx:158-193` — `handleApprove`/`handleReject` con try/catch,
    `toast.success` con título del reel y `toast.error` con
    `err?.body?.error || err?.message`.
  - `Dashboard.jsx:140, 197` — `pendingAction` + `actionInFlight` (incluye
    `approving || rejecting` del hook) deshabilitan AMBOS botones de TODAS
    las cards mientras hay un POST in-flight, evitando double-click.
  - `ReelCard.jsx:80-97` — `disabled` y `aria-busy={pending==='approve'
    ? 'true' : undefined}`, icon flip a `clock` mientras la acción está
    in-flight. `data-testid` `reel-approve-${id}` y `reel-reject-${id}`
    para los tests.

- **C6 (tests E2E 3×3 viewports + sin regresión):** [x]
  - `tests/reels_dashboard_live_sync.spec.js:59-228` — 3 tests reales:
    refetch on close (`:59-151`), success toast on approve (`:153-184`),
    error toast on approve fail (`:186-228`). Playwright config los
    instancia en `[desktop|tablet|mobile]` = 9 specs (verificado en run:
    "Running 9 tests using 4 workers", `9 passed (11.5s)`).
  - El test 1 stubea `GET /reels` con `bWasMutated` flag para forzar el
    reordenamiento [B,A,C] tras la mutación → demuestra que el refetch
    SE dispara al cerrar el editor (los `listFetches` incrementan).
  - `:101-110` — `page.on('response')` engancha el flag al `PATCH
    /reels/.../music` 200, no a un timer mágico.
  - El test 2 chequea `[role="status"][data-testid="toast-success"]` —
    cobertura del aria correcto.
  - El test 3 chequea `[role="alert"][data-testid="toast-error"]` con
    el mensaje del back (`INTERNAL_ERROR|simulated 500|Failed to
    approve`) → cobertura del path de error.

- **C7 (no banned libs, no TS, no nuevas deps, no backend):** [x]
  - `npm run lint` verde (0 errores).
  - `grep "from 'react-query'|from 'msw'|tailwind|@emotion|styled-components"
    src/` → cero matches.
  - Diff de `package.json` sólo añade campo `"license": "GPL-2.0-only"`,
    sin entradas en `dependencies` ni `devDependencies`.
  - `init.sh` reporta `[OK] Sin TypeScript en src/` y `[OK] package.json
    sin libs prohibidas`, exit 0.
  - Backend (`/opt/projects/4Reels-Backend`) tiene cambios independientes
    en otras ramas pero NINGUNO atribuible a feature 39 (el implementer
    sólo modifica archivos en `/opt/projects/4Reels-Frontend`; verificado
    con la lista de archivos del informe vs. `git status` del back, que
    está en `ghl` con commits previos a esta sesión).

- **C8 (feature 39 NO marcada `done`):** [x]
  - `feature_list.json` → `id:39 → status:'in_progress'`.

- **C9 (verificaciones reproducidas por el reviewer):** [x]
  - `npm run lint` → exit 0, 0 warnings.
  - `npm run build` → `dist/assets/index-C0tFPACT.js 429.54 kB │ gzip:
    123.44 kB`, exit 0.
  - `npm run test:e2e -- reels_dashboard_live_sync` → 9 passed (11.5s).
  - `npm run test:smoke` → 46 passed, 2 skipped (los dos preexistentes
    de theme en flows.spec.js).
  - `npm run test:e2e` (full) → **330 passed, 2 skipped, 1 failed**.
    - El failed es `tests/social_templates.spec.js:19 [desktop]` con
      "Expected: 200 / Received: []" sobre `putStatuses`. Re-ejecutado
      aislado con `npx playwright test tests/social_templates.spec.js:19
      --project=desktop` → **1 passed (676ms)**. Misma categoría flake
      de paralellismo documentada en reviews 32-37. El implementer
      reportó esta misma flake en otra spec del mismo grupo
      (`templates.spec.js:17 [desktop]`) — rota entre runs, no es
      regresión de feature 39.
  - `bash ./init.sh` → exit 0.

## 3. Observaciones (no bloqueantes)

1. **`ReelCard` pasa `reel.id` al callback, Dashboard lo descarta.**
   `ReelCard.jsx:82-91` invoca `onApprove?.(reel.id)` / `onReject?.(reel.id)`,
   pero `Dashboard.jsx:415-416` envuelve los callbacks ignorando el arg y
   pasando `r` completo a `handleApprove(reel)`. Funcional pero la firma
   queda confusa. No requiere fix.

2. **`actionInFlight` global puede sentirse demasiado agresivo si el
   refetch tarda > 2 s en producción.** El implementer lo justifica en su
   §3.7 — válido como elección, pero conviene monitorizar tras manual QA.
   Si molesta, un follow-up acotaría el lock a la card que originó la
   acción.

3. **`__resetToastsForTests`** está exportado en `useToast.js:124-129` sin
   tests que lo usen. No molesta (es un helper no documentado en el
   public surface), pero su valor real aparecerá cuando se introduzca
   Vitest. Sin acción.

4. **Mismo flake paralellismo:** la misma familia de tests
   (`social_templates.spec.js:19/233`, `templates.spec.js:17`,
   `payload_contract.spec.js:20`) lleva flakeando entre reviews 32-37 con
   el `vite preview` bajo 4 workers. Propuesta del implementer
   (`workers: 2` en `playwright.config.js`) sigue siendo razonable —
   abrir como feature/maintenance separada, fuera de scope 39.

5. **i18n.** Toasts en inglés ("Reel approved", "Photos saved
   (re-rendering)", "Reel rejected") consistente con el resto del UI.
   Una cadena en español sobrevive en `MusicOverridePanel.jsx`
   (preexistente, no del scope 39).

## 4. Acción del leader

- Mover `id:39 → status:'done'` en `feature_list.json`.
- Actualizar `progress/current.md` con el cierre (referencia a
  `progress/impl_39…` y `progress/review_39…`) y mover el bloque a
  `progress/history.md` si la convención del repo así lo requiere.
- Manual QA contra `:8001` según playbook §8 del informe.
