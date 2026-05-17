# Exploración: Feature Manual Publish desde Editor

**Fecha:** 2026-05-13  
**Alcance:** Mapear hooks, API, mock backend, endpoints y flujo de estado para habilitar el botón "Publish" en el ReelEditor.

---

## 1. Hook `useApproveReel` y `useRejectReel`

**Archivo:** `/opt/projects/4Reels-Frontend/src/features/reels/hooks.js:31-40`

```javascript
export function useApproveReel() {
  return useMutation(({ agencyId, siteId, sourcePropertyId }) =>
    reelsApi.approve(agencyId, siteId, sourcePropertyId),
  );
}

export function useRejectReel() {
  return useMutation(({ agencyId, siteId, sourcePropertyId }) =>
    reelsApi.reject(agencyId, siteId, sourcePropertyId),
  );
}
```

**Patrón:**
- Retorna `[mutate, { loading, error, reset }]` via `useMutation` (definido en `src/lib/hooks/useApi.js:58-84`)
- Ambas funciones delegan al layer de API sin pasar payload alguno (ver punto 3 abajo)
- El `mutate` es una función que espera `{ agencyId, siteId, sourcePropertyId }` y devuelve el resultado del API call

**Observación importante:** No existe `usePublishReel` hoy; el Publish es un botón `coming-soon` y `disabled` (ReelEditor.jsx:373-380).

---

## 2. Interfaz API: `reelsApi`

**Archivo:** `/opt/projects/4Reels-Frontend/src/features/reels/api.js:22-53`

```javascript
export const reelsApi = {
  list: (agencyId) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/reels`),
  get: (agencyId, siteId, sourcePropertyId) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId)),
  listImages: (agencyId, siteId, sourcePropertyId) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/images')),
  approve: (agencyId, siteId, sourcePropertyId) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/approve'), {
      method: 'POST',
    }),
  reject: (agencyId, siteId, sourcePropertyId) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/reject'), {
      method: 'POST',
    }),
};
```

**Rutas:**
- Approve: `POST /v1/admin/agencies/{agencyId}/reels/{siteId}/{sourcePropertyId}/approve`
- Reject: `POST /v1/admin/agencies/{agencyId}/reels/{siteId}/{sourcePropertyId}/reject`
- **No existe endpoint `/publish` hoy.**

**Contrato actual:**
- **Request body:** Vacío (ambos son POSTs simples sin payload)
- **Response:** Ver punto 3 (mock backend)

---

## 3. Mock Backend: Handlers de Approve/Reject

**Archivo:** `/opt/projects/4Reels-Frontend/tests/support/mock-backend.js:143-164`

```javascript
await page.route(
  /\/v1\/admin\/agencies\/[^/]+\/reels\/[^/]+\/[^/]+(\/approve|\/reject)(\?|$)/,
  async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.fallback();
    const url = new URL(request.url());
    const isApprove = url.pathname.endsWith('/approve');
    const agencyId = extractAgencyId(url.toString());
    const reelPath = extractReelPath(url.toString());
    const body = {
      status: isApprove ? 'approved' : 'rejected',
      agency_id: agencyId,
      site_id: reelPath.siteId,
      source_property_id: reelPath.sourcePropertyId,
    };
    if (isApprove) {
      body.idempotent_replay = approveIdempotentReplay;
      body.scheduled_at = approveScheduledAt;
    }
    return route.fulfill(jsonResponse(body));
  },
);
```

**Response estructura:**
```javascript
{
  status: "approved" | "rejected",
  agency_id: string,
  site_id: string,
  source_property_id: string,
  // Solo si isApprove:
  idempotent_replay: boolean,
  scheduled_at: string | null  // ISO8601 UTC o null/missing
}
```

**Parámetro de test:**
- `installMockBackend(page, { approveScheduledAt: "2026-05-15T09:00:00Z" })` permite setear un `scheduled_at` futuro
- `approveIdempotentReplay: Boolean(options.approveIdempotentReplay)` controla la replay flag

**No existe handler para `/publish` hoy.**

---

## 4. Cliente API Real

**Archivo:** `/opt/projects/4Reels-Frontend/src/lib/api/client.js:42-119`

**Función clave:**
```javascript
export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, query, headers, signal } = options;
  // ... construcción de URL y headers ...
  let res = await fetch(url.toString(), {
    method,
    headers: requestHeaders,  // Incluye Authorization: Bearer <token>
    body: requestBody,
    signal,
    credentials: 'omit',
  });
  // ... manejo de respuesta ...
  return payload ?? null;
}
```

**Nota sobre body:**
- Si `options.body` es un objeto plain JS → se JSON.stringify() (línea 69)
- Si es FormData → se envía crudo sin `Content-Type` (multipart automático, línea 66)

**Auth:**
- `getAuthHeaders()` (línea 129-132) adjunta `Authorization: Bearer <token>` si existe token en `src/lib/api/authToken.js`
- El backend rechaza `/v1/admin/*` sin token con 401 (línea 99-101)

---

## 5. Estados de `publish_status` y `workflow_state`

**Archivo:** `/opt/projects/4Reels-Frontend/src/features/reels/publishStatus.js:1-25`

```javascript
export function mapPublishStatus(publishStatus, workflowState) {
  const status = String(publishStatus || workflowState || '').toLowerCase();
  if (status === 'published' || status === 'approved' || status === 'partial') return 'published';
  if (status === 'rejected') return 'rejected';
  if (status === 'failed') return 'failed';
  if (status === 'awaiting_review') return 'needs-approval';
  return status || 'pending';
}
```

**Valores backend (según comentario línea 5-16):**
- `publish_status` (terminal):
  - `awaiting_review` → UI badge "needs-approval" (amarillo)
  - `published` → UI badge "published" (verde)
  - `partial` → UI badge "published" (verde; publicó en algunas redes)
  - `failed` → UI badge "failed" (rojo)
  - `rejected` → UI badge "rejected" (rojo)
- `workflow_state` (fallback cuando `publish_status` vacío):
  - Valores usados temprano en el pipeline (antes de alcanzar publish_status)

**Lógica de condiciones en ReelEditor.jsx:318:**
```javascript
const canApproveOrReject = reel.publishStatus === 'needs-approval';
```
Solo muestra approve/reject si el status es `needs-approval`.

---

## 6. Componente `DescriptionsPanel`: Toggles y Persistencia

**Archivo:** `/opt/projects/4Reels-Frontend/src/features/reels/editor/DescriptionsPanel.jsx:8-79`

**Estado local:**
```javascript
export function DescriptionsPanel({ descs, setDescs, activeNet, setActiveNet }) {
  const socials = useSocials();
  const current = descs[activeNet] || { enabled: false, text: '' };
  
  const setText = (text) => setDescs({ ...descs, [activeNet]: { ...current, text } });
  const setEnabled = (enabled) => setDescs({ ...descs, [activeNet]: { ...current, enabled } });
  
  return (
    // ... tabs por plataforma ...
    <Toggle
      on={current.enabled}
      onChange={setEnabled}
      label={`Publish to ${net?.name}`}
      sub={net?.handle || 'Not connected'}
    />
    <textarea value={current.text} onChange={(e) => setText(e.target.value)} />
```

**Estructura de `descs`:**
```javascript
{
  "instagram": { enabled: true, text: "..." },
  "tiktok": { enabled: false, text: "..." },
  "facebook": { enabled: true, text: "..." },
  // ... etc para cada red
}
```

**Inicialización (ReelEditor.jsx:132-139):**
```javascript
const [descs, setDescs] = useState(() => {
  const out = {};
  for (const s of socials) {
    out[s.id] = { enabled: false, text: DEFAULT_DESCRIPTION };
  }
  return out;
});
const [activeNet, setActiveNet] = useState(socials[0]?.id || 'instagram');
```

**Comportamiento actual:**
- El estado `descs` es **puramente local** en el ReelEditor, **no se persiste** en ningún sitio
- Cada red tiene un toggle `enabled` (bool) y `text` (string)
- Al hacer approve/reject, **no se envía este estado al backend** (el body del POST approve es vacío)
- El backend gestiona automáticamente qué redes publican según `agency_automation_rules.platforms` global

**Comentario en DOCS.md § Descriptions:**
> "Descriptions tab — one editable copy + preview per connected network."

No hay mención a que el UI selections de DescriptionsPanel se envíen al backend hoy.

---

## 7. Flujo Actual en ReelEditor

**Archivo:** `/opt/projects/4Reels-Frontend/src/features/reels/editor/ReelEditor.jsx:93-206`

**Estado del editor:**
```javascript
const [approve, { loading: approving }] = useApproveReel();
const [reject, { loading: rejecting }] = useRejectReel();
const [submitting, setSubmitting] = useState(false);  // Cubre POST + refetch
const [descs, setDescs] = useState(/* ... */);  // Local, no enviado
```

**Handler de aprobación (líneas 151-184):**
```javascript
const handleApprove = async () => {
  if (submitting) return;
  setStatusMessage(null);
  setSubmitting(true);
  try {
    const result = await approve({
      agencyId,
      siteId: reel.siteId,
      sourcePropertyId: reel.sourcePropertyId,
    });
    // result = { status: 'approved', agency_id, site_id, source_property_id, scheduled_at?, ... }
    const scheduledLabel = formatScheduledAt(result?.scheduled_at);
    let text = scheduledLabel 
      ? `Publicará el ${scheduledLabel}.`
      : 'Reel approved.';
    setStatusMessage({ tone: 'success', text });
    await refetch();  // Recarga el reel del backend
  } catch (err) {
    setStatusMessage({ tone: 'danger', text: err?.message });
  } finally {
    setSubmitting(false);
  }
};
```

**Header (líneas 309-383):**
- Botones Approve/Reject visibles solo si `canApproveOrReject = (reel.publishStatus === 'needs-approval')`
- Botón Publish deshabilitado/coming-soon en cualquier otro estado

---

## 8. Endpoint Backend Real: ¿Existe `/publish`?

**Búsqueda:**
```bash
grep -r "publish" /opt/projects/4Reels-Frontend --include="*.md"
# Resultados en DOCS.md
```

**En DOCS.md § Backend contract (línea 159-171):**
```markdown
- **Publishing** — native APIs for IG, TikTok, YT, FB, LinkedIn, GMB. One short link per publish.
- **Approvals** — transactional emails with signed 1-click URLs.
- **Approve scheduling** — `POST /v1/admin/agencies/{id}/reels/{site_id}/{source_property_id}/approve`
  returns a `scheduled_at` (`string | null`, ISO8601 UTC).
  ...
```

**Observación:**
- No menciona un endpoint de "publish manual"
- El único endpoint wired es `/approve`
- El comentario en ReelEditor.jsx:377 dice:
  > "Manual publishing from the editor is on the roadmap. Today the pipeline auto-publishes (or holds for review) based on the agency's automation settings."

**Conclusión:** El backend **no expone un `/publish` endpoint hoy**. La feature propone agregarlo.

---

## 9. Resumen de lo que Falta para Manual Publish

1. **Nuevo endpoint backend:** `POST /v1/admin/agencies/{id}/reels/{site_id}/{source_property_id}/publish`
   - Payload esperado (a definir con backend):
     - Redes seleccionadas: `platforms: ["instagram", "tiktok", "facebook"]`
     - Descriptions por red: `descriptions: { "instagram": "...", "tiktok": "...", ... }`
     - O ambas, o solo las de red seleccionadas

2. **Nuevo hook frontend:** `usePublishReel()` (patrón como approve/reject)
   - Llamaría a `reelsApi.publish(agencyId, siteId, sourcePropertyId, payload)`

3. **Nueva función en `reelsApi`:** `publish(agencyId, siteId, sourcePropertyId, payload)`
   - POST con body que incluya networks/descriptions

4. **Mock handler en Playwright:** `/publish` endpoint route

5. **Cambio en ReelEditor:**
   - Botón "Publish" visible cuando `publishStatus !== 'needs-approval'` (o siempre si la feature es "publish siempre")
   - Pasa `descs` al hook de publish
   - Muestra loader/mensaje de éxito

6. **Cambio en DescriptionsPanel:** Posiblemente persistir a backend (a definir según UX)

---

## 10. Referencias Clave en Código

| Entidad | Ruta | Líneas | Descripción |
|---------|------|--------|-------------|
| `useApproveReel` hook | `src/features/reels/hooks.js` | 31-35 | Mutation wrapper para approve |
| `reelsApi.approve` | `src/features/reels/api.js` | 31-34 | POST /approve endpoint |
| Mock approve handler | `tests/support/mock-backend.js` | 143-164 | Route intercept + respuesta |
| `mapPublishStatus` | `src/features/reels/publishStatus.js` | 18-25 | Mapeo estados backend → UI |
| `DescriptionsPanel` | `src/features/reels/editor/DescriptionsPanel.jsx` | 8-79 | Panel de descripciones por red |
| `ReelEditor` header | `src/features/reels/editor/ReelEditor.jsx` | 309-383 | Botones approve/reject/publish |
| Publish button | `src/features/reels/editor/ReelEditor.jsx` | 373-380 | Coming-soon disabled button |
| `handleApprove` | `src/features/reels/editor/ReelEditor.jsx` | 151-184 | Handler aprobación completo |
| API request client | `src/lib/api/client.js` | 42-119 | HTTP layer con auth |
| Backend contract | `DOCS.md` | § Backend contract | Spec del contrato live |

---

## 11. Contrato de Backend Esperado (Propuesta)

Basado en el patrón actual de approve/reject, el `/publish` probablemente debería:

**Endpoint:**
```
POST /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/publish
```

**Request body (candidato):**
```javascript
{
  platforms: ["instagram", "tiktok", "facebook"],  // redes a publicar
  descriptions: {
    "instagram": "...",
    "tiktok": "...",
    "facebook": "..."
  }
}
```

O alternativamente:
```javascript
{
  descriptions: {
    "instagram": { enabled: true, text: "..." },
    "tiktok": { enabled: false, text: "..." },
    // ...
  }
}
```

**Response (candidato):**
```javascript
{
  status: "published" | "partial" | "failed",
  agency_id: string,
  site_id: string,
  source_property_id: string,
  scheduled_at?: string | null,  // Si se programa (similar a approve)
  published_platforms?: ["instagram", "tiktok"],  // Si aplica
  error?: string  // Si falló alguna red
}
```

---

## Conclusión

- **Approve/Reject:** Totalmente wired y probado. Endpoints simples sin payload.
- **Descriptions panel:** Local state solo, no persiste al backend hoy.
- **Publish manual:** Coming-soon. Requerirá:
  1. Backend debe exponer `POST /publish` con contrato de redes + descriptions
  2. Frontend: nuevo hook `usePublishReel()`, integración en ReelEditor, handler de UI
  3. Mock: handler Playwright para `/publish`
