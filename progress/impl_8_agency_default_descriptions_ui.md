# Impl 8 — agency_default_descriptions_ui

UI de descripciones por defecto por plataforma en el AgencyConfigDrawer.

## Archivos creados / modificados

| Archivo | Tipo | Cambio |
|---|---|---|
| `src/features/admin/DefaultDescriptionsPanel.jsx` | component (nuevo) | Panel del subtab. Carga GET, guarda PUT, 7 textareas. |
| `src/features/admin/AgencyConfigDrawer.jsx` | component (edit) | Anade entrada `descriptions` al array TABS y monta `<DefaultDescriptionsPanel>`. Pinterest y resto del codigo intactos. |
| `src/features/admin/admin.css` | css (edit) | Estilos nuevos: `.default-descriptions-form`, `.default-descriptions-grid`, `.default-description-textarea`, `.default-descriptions-help`, `.default-description-var`. |
| `tests/support/mock-backend.js` | mock handler (edit) | Refactor: el regex generico de `(brand|defaults|automation|social-templates|reel-profile)` ahora delega `social-templates` a `handleSocialTemplates()`, que mantiene un store por agencia y devuelve el shape canonico del back. |
| `tests/social_templates.spec.js` | smoke test (nuevo) | Round-trip GET+PUT del nuevo subtab. Verifica shape del body PUT, status 200, banner de exito, y persistencia (re-mount lee lo guardado). |
| `DOCS.md` | doc (edit) | Anade entrada `Social templates` al `Backend contract` con shape exacto de GET y PUT. |
| `feature_list.json` | metadata | feature 8 → `in_progress`. |
| `progress/current.md` | metadata | header + plan + decisiones de la feature en curso. |

## Decisiones (no obvias)

1. **Ubicacion del componente**: nuevo `<DefaultDescriptionsPanel>` montado por el drawer (no in-lined). El drawer ya esta en ~1010 lineas; un panel mas dentro lo hace menos manejable.
2. **Reutilizo `socialApi` existente** (`features/social/api.js`) en lugar de crear `socialTemplatesApi` nuevo. El path canonico ya estaba ahi y el cross-feature import (admin→social) tiene precedente (`automation/useAutomationSave.js → defaults/api.js`).
3. **Patron imperativo, no useApi/useMutation**: los demas paneles del drawer (Sources, Ghl, Reel, Agency) usan useState + useEffect + llamadas directas a `adminApi.*` porque el agencyId viene por prop (no de `useCurrentAgencyId`). Mantengo consistencia. Los hooks `useSocialTemplates` / `useSaveSocialTemplates` siguen sirviendo a la pagina /social del tenant.
4. **Plataformas**: incluidas las 7 (las 6 de la spec + `pinterest`). Pinterest ya esta presente en el resto del drawer (`AgencyConfigDrawer.jsx:567` y `:845`) y la feature 7 ya cerrada. El back acepta keys arbitrarias en `templates: dict[str, str]`, asi que no rompe nada.
5. **Shape canonico en el mock**: el handler generico devolvia `{agency_id, brand:null, ..., templates:{}, ...}` para todos los slices. Lo split: el slice `social-templates` ahora pasa por `handleSocialTemplates()` y devuelve `{agency_id, templates, items, count}` exactamente como el back. Los demas slices siguen igual.

## Endpoints anadidos al mock

Estrictamente NO son nuevos paths (el regex ya capturaba `social-templates`), pero el comportamiento si se ajusta al contrato canonico:

- `GET /v1/admin/agencies/{id}/social-templates`
  - Response (200):
    ```json
    {
      "agency_id": "<uuid>",
      "templates": { "instagram": "..." },
      "items": [
        {
          "agency_id": "<uuid>",
          "platform": "instagram",
          "description_template": "...",
          "title_template": null,
          "hashtags": [],
          "created_at": "2026-05-12T12:00:00Z",
          "updated_at": "2026-05-12T12:00:00Z"
        }
      ],
      "count": 1
    }
    ```
- `PUT /v1/admin/agencies/{id}/social-templates`
  - Body: `{ "templates": { "<platform>": "<descriptionString>" } }` (extra='forbid' en el back).
  - Response (200): `{ "status": "saved", ...mismoShapeQueGET }`.

El handler mantiene un `Map` por agencyId que persiste entre llamadas dentro del mismo test, lo que permite verificar el round-trip GET (ver test 2 del spec nuevo).

## Variables permitidas (TODO sync con back)

El panel hint-ea las 13 variables del catalogo `STATIC_VARIABLES` de `TenantProvider.jsx:20-34`. La fuente de verdad real esta en `modules/reels/application/content_generator.py` del back; cuando ese expanda placeholders, sincronizar la lista (y considerar centralizarla en la respuesta del GET o en `/v1/variables`).

## Output verificacion

### `npm run lint`
```
> 4reels@0.0.0 lint
> eslint .
```
(verde, sin warnings)

### `npm run build`
```
dist/assets/index-DBJneyOZ.css                                  118.00 kB │ gzip:  29.36 kB
dist/assets/index-nlSEUBWM.js                                   369.29 kB │ gzip: 105.61 kB
✓ built in 2.23s
```

### `npm run test:smoke`
```
43 passed (58.2s) — 2 skipped (theme on tablet/mobile)
```

### `npx playwright test tests/social_templates.spec.js`
```
6 passed (9.8s)
  ✓ Descriptions subtab loads, edits, and saves via PUT (desktop/tablet/mobile)
  ✓ GET pre-populates textareas from existing templates  (desktop/tablet/mobile)
```

### `npx playwright test tests/payload_contract.spec.js tests/admin_auth.spec.js`
```
15 passed (29.0s) — sin regresiones en contract / auth
```

### `./init.sh`
```
[OK]  Entorno listo. Puedes empezar a trabajar.
```

## Reviewer pendiente

NO he marcado la feature como `done`. Esperando review.
