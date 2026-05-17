# State Management & Mutation-to-Refetch Audit — 4Reels Frontend

**Fecha:** 2026-05-16  
**Scope:** Investigación de cómo se gestiona estado servidor↔cliente, refetch de datos tras mutaciones, caching, y feedback al usuario.

---

## 1. Patrón de Fetching Dominante

### Cliente HTTP (`src/lib/api/client.js`)
- **Único entry point:** `apiRequest(path, options)` — hace `fetch()` al backend en `VITE_MVP_API_URL` o `BASE_URL`.
- **Manejo de errores:** Lanza `ApiError` con status, body y trace. NO devuelve `{ ok, error }`.
- **Multipart:** Detecta `FormData`, omite `Content-Type` para que el browser agregue boundary.
- **Auth:** Lee token de `authToken.js` vía hook `getAuthToken()`. Devuelve `{}` si no hay token.

### Patrón de Hook Compartido
**Archivo:** `src/lib/hooks/useApi.js`

```javascript
// Patrón: useApi(fetcher, deps)
const { data, loading, error, refetch } = useApi(
  () => reelsApi.list({ agencyId, page, ... }),
  [agencyId, page, ...]
);
```

- **Sin cache interno:** dos componentes que llaman `useReels()` en paralelo **hacen dos fetches**.
- **Refetch manual:** `refetch()` cambia un `tick`, que fuerza re-run del `useEffect`.
- **Deduplicación:** ninguna. El hook es "dumb" — lo único que hace es `useState` + `useEffect` + `refetch` function.

### Patrón de Mutación
**Archivo:** `src/lib/hooks/useApi.js` (`useMutation`)

```javascript
const [mutate, { loading, error, reset }] = useMutation(performer);
// Caller: await mutate(args)  // throws on error
```

- **Stateful loading/error:** expone flags para spinners / error messages.
- **Sin invalidation automática:** la caller decide cuándo hacer `refetch()`.
- **Sin retry lógico:** falla inmediatamente.

### Censo: Dónde se Fetcha

| Feature | Patrón | Archivo |
|---------|--------|---------|
| **Reels (list)** | `useReels(params)` → `useApi` + `reelsApi.list()` | `reels/hooks.js:26-77` |
| **Reel (detail)** | `useReel(siteId, id)` → `useApi` + `reelsApi.get()` | `reels/hooks.js:84-180` |
| **Reel images** | `useReelImages()` → `useApi` + `reelsApi.listImages()` | `reels/hooks.js:310-335` |
| **Music tracks** | `useTracks()` → `useApi` + `musicApi.listTracks()` | `music/hooks.js:5-21` |
| **Brand** | `useBrand()` → `useApi` + `brandApi.getBrand()` | `brand/hooks.js:11-18` |
| **Defaults** | `useReelDefaults()` → `useApi` + `defaultsApi.getDefaults()` | `defaults/hooks.js:73-81` |
| **Fonts (global)** | `useAvailableFonts()` → `useApi` + `fontsApi.listAvailableFonts()` | `brand/hooks.js:41-49` |
| **Socials** | Fetched en `TenantProvider` (global), expuesto vía `useSocials()` | `app/providers/TenantProvider.jsx:62-137` |

### Global State Management

**Context providers:**
1. **`TenantProvider`** (`src/app/providers/TenantProvider.jsx`)
   - Fetchea socials **una sola vez** al montar (disparado por `useCurrentAgency()`).
   - Expone: `useAgency()`, `useSocials()`, `useVariables()`, `useTenantStatus()`.
   - Tiene `refetch()` para forzar re-fetch de socials (pocas veces usado).
   - **NO invalida tras mutaciones** — si se añade/modifica una red social, queda stale hasta logout/reload.

2. **`SessionProvider`** (`src/features/session/SessionProvider.jsx`)
   - Maneja GHL session + agency context. Lo importado: **`useCurrentAgencyId()`** — gatillador para todos los fetches scoped.

3. **`ThemeProvider`** (`src/app/providers/ThemeProvider.jsx`)
   - Solo tema (claro/oscuro).

**Sin Redux, sin Zustand, sin Context mutation.**

---

## 2. Mutación → Refetch: 5 Casos Representativos

### Caso 1: Brand `showAgentPhoto` Toggle
**Archivo:** `src/features/brand/BrandConfig.jsx:51-120`

```javascript
// Línea 60: estado local
const [showAgentPhoto, setShowAgentPhoto] = useState(true);

// Línea 109: mutación
await defaultsApi.saveDefaults(agencyId, {
  settings: { showAgentPhoto },
});

// Línea 113: refetch de defaults
await refetchDefaults();
```

**Flujo:**
1. User toggles checkbox → `setShowAgentPhoto(newVal)` (local).
2. `handleSave()` → PUT `/defaults` con `{settings: {showAgentPhoto}}`.
3. Refetch: `refetchDefaults()` (via `useReelDefaults().refetch`).
4. **PROBLEMA:** Los reels ya renderizados NO se regeneran. Solo las futuras búsquedas/cargas usan el nuevo default. Los usuarios deben recargar para ver cambio en reel list si visibles.

---

### Caso 2: Music Upload Nuevo Track
**Archivo:** `src/features/music/MusicConfig.jsx:13-30`

```javascript
const { tracks, ..., refetch } = useTracks();
const [uploadTrack, uploadState] = useUploadTrack();

const refreshAfter = async (operation) => {
  try {
    await operation();
    refetch();  // Línea 25
  } catch (err) {
    setActionError(err);
    throw err;
  }
};

// Línea 89-91: caller
onCreate={(formData) =>
  refreshAfter(() => uploadTrack({ agencyId, formData }))
}
```

**Flujo:**
1. POST multipart a `/music/upload`.
2. Success → `refetch()` → re-run `useApi` → lista de tracks actualizada al instante.
3. **BUENO:** la lista se invalida automáticamente tras cada mutación.
4. **PERO:** otros componentes que tengan cached `useTracks()` en paralelo no refetch — cada instancia tiene su propia llamada + estado.

---

### Caso 3: Per-Reel Music Override PATCH
**Archivo:** `src/features/reels/editor/MusicOverridePanel.jsx:74-98`

```javascript
const handleChange = async (nextValue) => {
  const previous = value;
  setValue(nextValue);  // Optimistic local
  setFeedback(null);
  try {
    await patch({
      agencyId,
      siteId: reel.siteId,
      sourcePropertyId: reel.sourcePropertyId,
      musicId: nextValue || null,  // Línea 83
    });
    setFeedback({...});  // Success message
    if (typeof refetchReel === 'function') {
      await refetchReel();  // Línea 92
    }
  } catch (err) {
    setValue(previous);  // Rollback
    reportError(err);
  }
};
```

**Flujo:**
1. User selects music track from dropdown.
2. **Optimistic:** local `setValue(nextValue)` al instante.
3. PATCH `/reels/{site}/{prop}/music`.
4. Success → `refetchReel()` (refetch del reel detail).
5. Failure → `setValue(previous)` (rollback).
6. **BUENO:** optimistic + feedback + rollback.
7. **PROBLEMA:** Reel list (Dashboard) NO se invalida. Si el user vuelve atrás y mira la lista, la card sigue mostrando stale data hasta reload o navegación.

---

### Caso 4: Per-Reel Photos Override PATCH (Debounce + Poll)
**Archivo:** `src/features/reels/editor/PhotosPanel.jsx` + `useReelDebouncedOverride.js`

```javascript
// PhotosPanel.jsx:46
const [patch, { loading: saving }] = useReelPhotosOverride();

// PhotosPanel.jsx:51-62: build PATCH body
const patchFn = useCallback((desired) =>
  patch({
    agencyId,
    siteId: reel?.siteId,
    sourcePropertyId: reel?.sourcePropertyId,
    photos: desired.map((item, index) => ({
      position: index,
      selected: Boolean(item.selected),
    })),
  }),
  [...]
);

// PhotosPanel.jsx:65-80: hook que maneja debounce + refetch
const { schedule, feedback, clientLocked, rerendering } = 
  useReelDebouncedOverride({
    reel,
    refetchReel,
    latest: photos,
    debounceMs: DEBOUNCE_MS,
    patchFn,
    rollback: setPhotos,
    lockedErrorCode: 'PHOTOS_OVERRIDE_LOCKED',
    successText: 'Re-rendering with new photo order…',
    fallbackErrorText: 'Failed to save photo changes.',
  });
```

**Flujo:**
1. User toggles/drags photo.
2. `setPhotos(newState)` (local).
3. `schedule()` → debounce 500ms.
4. Timeout → `flush()` → PATCH.
5. Post-PATCH: `refetchReel()` → reel detail actualizado.
6. **Poll:** Mientras `renderStatus === 'pending'`, `refetchReel()` cada 1.5s (línea 173 en `useReelDebouncedOverride.js`).
7. **BUENO:** debounce, poll, optimistic, rollback, feedback.
8. **PROBLEMA:** Reel list NO se invalida. Dashboard sigue mostrando stale cover/status hasta manual refresh.

---

### Caso 5: Reel Approve/Reject (Dashboard Actions)
**Archivo:** `src/features/reels/Dashboard.jsx:135-150`

```javascript
const [approve] = useApproveReel();
const [reject] = useRejectReel();
const { reels, ..., refetch } = useReels({...});

const handleApprove = async (reel) => {
  await approve({
    agencyId,
    siteId: reel.siteId,
    sourcePropertyId: reel.sourcePropertyId,
  });
  refetch();  // Línea 141
};

const handleReject = async (reel) => {
  await reject({
    agencyId,
    siteId: reel.siteId,
    sourcePropertyId: reel.sourcePropertyId,
  });
  refetch();  // Línea 149
};
```

**Flujo:**
1. POST `/reels/{site}/{prop}/approve` (o `/reject`).
2. Success → `refetch()` → re-fetch reel list.
3. Dashboard table/grid se actualiza.
4. **BUENO:** refetch inmediato y automático.
5. **PERO:** Si el editor está abierto en la misma sesión (nested overlay), NO refetch automático — solo cierra on error, pero el modal del editor no sabe que fue approve'd. User debe cerrar y re-abrir para ver status actualizado.

---

## 3. Caché de Listas

### Reel List (Dashboard)
- **Endpoint:** `GET /v1/admin/agencies/{id}/reels?page=...&page_size=...&workflow_state=...&publish_status=...&q=...`
- **Fetched en:** `Dashboard.jsx:111-118` via `useReels(params)`.
- **Deps:** `[agencyId, page, pageSize, workflowState, publishStatus, q]` (línea 54-61 en `reels/hooks.js`).
- **Invalidation:** Automático cuando URL params cambian (vía deps).
- **Manual refetch:** `refetch()` en `handleApprove()` (línea 141), `handleReject()` (línea 149).
- **PROBLEMA:** Cada mutación a un reel individual (photos, music, descriptions, etc.) **NO invalida la lista**. La list sigue cached/stale hasta:
  - El user navega fuera y vuelve (URL change → deps trigger → re-fetch).
  - El user cliquea una acción que dispara refetch (approve/reject).
  - El user recarga la página manualmente.

### Music Tracks List
- **Endpoint:** `GET /v1/admin/agencies/{id}/music`.
- **Fetched en:** `MusicConfig.jsx:14` via `useTracks()`.
- **Deps:** `[agencyId]` (línea 12 en `music/hooks.js`).
- **Invalidation:** Manual `refetch()` tras cada mutación (uploadTrack, reconfigureTrack, decommissionTrack).
- **BUENO:** la práctica es llamar `refreshAfter(operation)` que automáticamente hace refetch.

### Brand / Defaults
- **Fetched:** `useBrand()` y `useReelDefaults()` con deps `[agencyId]`.
- **Invalidation:** Manual `refetch()` post-save.
- **Prob: No hay "lista" de brands/defaults — solo one per agency.**

### Socials (Shared State)
- **Fetched en:** `TenantProvider.jsx` al montar (deps: `[agencyId]`).
- **Shared vía:** `useSocials()`, `useSocial(id)`.
- **Invalidation:** Llamar `useTenantStatus().refetch()` (línea 207).
- **PROBLEMA:** Pocas veces se refetch tras mutación. Si alguien añade/modifica una red social desde otro tab/admin, la lista es completamente stale.

---

## 4. Sistema de Toasts / Feedback

### No existe hook global `useToast()` o `<Toaster>`
- **Patrón:** Cada componente maneja su propio `statusMessage` o `feedback` state.
- **Ubicación típica:**
  ```javascript
  const [statusMessage, setStatusMessage] = useState(null);
  // ...
  {statusMessage && <div className="card ...">...</div>}
  ```

### Ejemplos por Feature

| Feature | Archivo | Línea | Patrón |
|---------|---------|-------|--------|
| Brand | `BrandConfig.jsx` | 50, 181–189 | Card inline + `statusMessage` state |
| Music | `MusicConfig.jsx` | 19, 59–66 | Card inline + `actionError` state |
| Reel Editor (Approve) | `ReelEditor.jsx` | 102, 256–264 | Card inline + `statusMessage` state |
| Photos Panel | `PhotosPanel.jsx` | 65–80 (hook), 118–129 | `feedback` vía `useReelDebouncedOverride` |
| Descriptions Panel | `DescriptionsPanel.jsx` | 68, 177–185 | `feedback` state + card render |
| Music Override | `MusicOverridePanel.jsx` | 44, 162–173 | `feedback` state + div inline |

### Mutaciones SIN Feedback Explícito

1. **Reel Approve en Editor** (`ReelEditor.jsx:183–216`)
   - ✅ Muestra success message vía `statusMessage`.

2. **Reel Reject en Editor** (`ReelEditor.jsx:218–238`)
   - ✅ Muestra success message vía `statusMessage`.

3. **Reel Approve en Dashboard** (`Dashboard.jsx:135–141`)
   - ❌ **NO hay feedback.** El user cliquea approve, refetch happens silently. No toast, no message, no spinner visual que indique que algo está pasando.

4. **Reel Reject en Dashboard** (`Dashboard.jsx:143–149`)
   - ❌ **NO hay feedback.** Igual que approve.

5. **Descriptions Save (individual platform)** (`DescriptionsPanel.jsx:149–199`)
   - ✅ Muestra success/error vía `feedback` state.

6. **Subtitles Save (individual)** (`SubtitlesPanel.jsx` — não leí en detalle)
   - ✅ Presumiblemente `feedback` vía hook.

7. **Slides Save (individual)** (`SlidesPanel.jsx` — não leí en detalle)
   - ✅ Presumiblemente `feedback` vía hook.

---

## 5. Errores de Red (`lib/api/client.js`)

### Comportamiento al Fallar

```javascript
// Línea 73-92: Network error
try {
  res = await fetch(url.toString(), {...});
} catch (error) {
  const apiError = new ApiError(
    0,
    `Network/CORS error calling ${url.origin}. ...`,
    { cause: error.message },
    finishTrace(trace, {...})
  );
  logApiError(apiError.trace);
  throw apiError;  // ← LANZA EXCEPCIÓN
}

// Línea 98-114: HTTP error (status >= 400)
if (!res.ok) {
  if (res.status === 401 && isAdminPath(path)) {
    notifyUnauthorized();
  }
  const apiError = new ApiError(
    res.status,
    payload?.message || payload?.error || res.statusText,
    payload || text,
    finishTrace(trace, {...})
  );
  logApiError(apiError.trace);
  throw apiError;  // ← LANZA EXCEPCIÓN
}
```

**Resumen:**
- **No devuelve `{ ok, error }`** — lanza `ApiError` directamente.
- **Quién lo captura:**
  - `useApi`: en el `.catch()` del promise (línea 37–40 en `useApi.js`).
  - `useMutation`: en el `.catch()` del promise (línea 71–74 en `useMutation`).
  - Componentes que esperan `.catch()` en el `await mutate(...)` call.
- **401 Admin:** Llama `notifyUnauthorized()` (sideline redirige a login).
- **Logging:** Llama `logApiError(trace)` que hace `console.groupCollapsed` si `API_TRACE !== 'false'`.

---

## 6. Routing y Stale State

### Arquitectura de Rutas (`src/app/Shell.jsx`)

```javascript
<Routes>
  <Route path="/reels" element={<RequirePermission...><ReelsRoute/></RequirePermission>}>
    <Route path=":siteId/:sourcePropertyId" element={<ReelEditorRoute/>} />
  </Route>
  <Route path="/music" ... />
  <Route path="/brand" ... />
  <Route path="/defaults" ... />
  <Route path="/automation" ... />
  <Route path="/social" ... />
  <Route path="/templates" ... />
  <Route path="/v1/admin" ... />
</Routes>
```

### ReelsRoute Structure
```javascript
function ReelsRoute() {
  return (
    <>
      <Dashboard />        {/* Siempre renderizado */}
      <Outlet />           {/* Modal overlay si :siteId/:sourcePropertyId */}
    </>
  );
}
```

### State Persistence / Reset

| Navegación | State | Comportamiento |
|------------|-------|---|
| `/reels` → `/reels/:id` (overlay) | Dashboard `useReels()` state | **Persiste.** Dashboard sigue en memoria, reels list visible bajo el overlay. |
| `/reels/:id` → `/reels` (close overlay) | Dashboard state | **Persiste.** Vuelves a ver la dashboard con la misma página/filtros. URL search params se preservan. |
| `/reels` → `/music` | Reel list + editor state | **Descartado.** Dashboard y ReelEditor unmount. Socials/TenantProvider persisten (global context). |
| `/music` → `/reels` | Music list state | **Descartado.** MusicConfig unmount. Reel list re-fetches (new `useReels()` mount). |
| `/music` → `/brand` | Music state | **Descartado.** MusicConfig unmount. Brand re-fetches fresh. |

### State Descarte Behavior (cuando unmount)
- **`useApi` cleanup:** Nada especial. El componente unmount, el hook cleanup corre, pero no hay ref/cache global.
- **`TenantProvider`:** Persiste (global). Socials, agency, variables siguen en memoria.
- **`SessionProvider`:** Persiste (global). Autorización + agencyId siguen en memoria.

**RESULTADO:** Cada feature es **isla aislada**. No hay cascade invalidation. Si editas un reel en `/reels/:id` (music, photos, etc.) y navegas a `/music`, luego vuelves a `/reels`, el list es **stale** — debe refetch (que sí sucede por deps), pero durante el viaje a `/music` y vuelta, nadie avisa al dashboard que refetch.

---

## 7. Patrón Existente que Funciona Bien: Music CRUD

**Ubicación:** `src/features/music/`

**Por qué funciona:**

1. **Isolate list:** `useTracks()` en `MusicConfig.jsx` es el único dueño de la lista.
2. **Todas las mutations vuelven al mismo componente:**
   ```javascript
   onCreate={(formData) => refreshAfter(() => uploadTrack(...)) }
   onUpdate={(musicId, body) => refreshAfter(() => reconfigureTrack(...)) }
   onDelete={(musicId) => refreshAfter(() => decommissionTrack(...)) }
   ```
3. **`refreshAfter` pattern:**
   ```javascript
   const refreshAfter = async (operation) => {
     try {
       await operation();
       refetch();  // ← Garantizado
     } catch (err) {
       setActionError(err);
       throw err;
     }
   };
   ```
4. **Feedback:** 
   ```javascript
   const [actionError, setActionError] = useState(null);
   {(error || actionError) && <div className="card music-note danger">...</div>}
   ```
5. **UI bien coordinada:** Upload, edit, delete viven en `MusicLibrary` sub-component que recibe callbacks. No hay nested routes ni overlays.

**Contraste con Reels:**
- Reel list vive en `Dashboard.jsx`, edits viven en overlay `ReelEditor.jsx` (nested route).
- El editor NO refetch la lista (es el padre Dashboard quien tiene la list).
- Post-mutación en editor, refetch solo del reel detail, no de la list.

---

## 8. Tabla de Problemas Encontrados

Prioridad (1 = crítico, 3 = improvement):

| Prioridad | Archivo:Línea | Componente | Problema | Solución |
|-----------|---------------|-----------|---------|----------|
| 1 | `Dashboard.jsx:135–149` | Approve/Reject buttons | **Sin feedback ni spinner.** User cliquea, no hay visual feedback de que algo está pasando. | Mostrar spinner + toast on success/error. |
| 1 | `Dashboard.jsx:111–118` | Reel list (useReels) | **Stale tras mutación en editor.** Las mutations a un reel (photos, music, descriptions) no invalidan la list. Dashboard sigue cached. | Post-editor-close, refetch la lista. O: push reel changes → list update. |
| 1 | `ReelEditor.jsx:1–350` | Editor overlay | **Editor no refetch parent dashboard list.** Après approve/reject/close, dashboard NO refetch. | Editor debe callback parent Dashboard.refetch() on significant mutation. |
| 2 | `BrandConfig.jsx:109–113` | Brand + showAgentPhoto | **Dos mutaciones separadas.** Savebrand + saveDefaults. Si una falla, state parcialmente aplicado. | Atomicity: un single call con ambos cambios. |
| 2 | `MusicOverridePanel.jsx:91–92` | Music override | **Refetch reel detail sí, pero dashboard list stale.** Si user vuelve al dashboard, card sigue con old data. | Propagar change up a parent Dashboard. |
| 2 | `PhotosPanel.jsx:65–80` | Photos edit | **Refetch reel detail sí, pero list stale.** Debounce + patch + poll funciona para detail, pero Dashboard list ignora. | Post-editor-close, Dashboard refetch. |
| 2 | `DescriptionsPanel.jsx` | Descriptions edit | Mismo patrón: refetch reel detail, pero no list. | Post-editor-close, Dashboard refetch. |
| 2 | `SubtitlesPanel.jsx` | Subtitles edit | Mismo patrón: refetch reel detail, pero no list. | Post-editor-close, Dashboard refetch. |
| 2 | `SlidesPanel.jsx` | Slides edit | Mismo patrón: refetch reel detail, pero no list. | Post-editor-close, Dashboard refetch. |
| 3 | `TenantProvider.jsx:69–93` | Socials | **Sin refetch trigger en UI.** Si alguien añade red social vía admin, usuarios no ven cambio sin reload. | Exponer refetch button en topbar o auto-refresh on interval. |
| 3 | `src/lib/hooks/useApi.js` | Generic hooks | **Sin client-side cache.** Dos `useReels()` calls = dos fetches. Acceptable hoy, pero escala mal. | Optional per-key cache (memoized in module). |
| 3 | `MusicConfig.jsx:59–66` | Music error | **actionError state pero sin clear on successful retry.** Si falla, luego éxito, la tarjeta roja persiste. | `setActionError(null)` en `refreshAfter` success path. |

---

## Resumen Ejecutivo

### Arquitectura Actual
- **Fetching:** Minimal `useApi` + `useMutation` hooks. Sin React Query, sin Zustand, sin cache automática.
- **Global state:** TenantProvider + SessionProvider. Muy ligero.
- **Mutaciones:** Cada componente decide cuándo refetch.
- **Feedback:** Inline card messages + spinners. Sin global toast layer.

### Puntos Calientes
1. **Reel Dashboard list es stale tras edits en overlay editor.** Refetch manual post-editor-close es la solución.
2. **Approve/Reject en dashboard sin feedback.** Necesita spinner + toast.
3. **Atomicity de multi-field saves.** Brand + defaults are split calls hoy.
4. **No hay cascade invalidation.** Cada feature refetch su lista, pero no hay "invalidate all related"notions.

### Recomendación
Implementar un pattern de "editor onClose callback" que refetch la parent list. Alternativamente, elevar mutaciones a la Dashboard level para manejar refetch centralizadamente.

---

**Auditor:** Claude Code (Haiku 4.5)  
**Duración:** ~2h exploración + análisis.
