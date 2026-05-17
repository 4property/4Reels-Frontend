# Leader handoff — 2026-05-15 (Claude, rol leader, lado front)

> Espejo del handoff del back. Para detalles cross-repo, leer también
> `/opt/projects/4Reels-Backend/progress/leader_handoff_2026-05-15.md`.

## Resumen ejecutivo del sprint

Sprint features **32–37** orquestado por el leader en paralelo
back ↔ front. Estrategia aprobada en el turno inicial: una feature por
repo a la vez, back+front simultáneos.

| Feature | Back | Front | Estado |
|--------:|:----:|:-----:|:------|
| 32 — reels list pagination + filters UI | ✅ | ✅ | done |
| 33 — outro upload UI | ✅ | ✅ | done |
| 34 — intro upload UI (refactor → `UploadVideoCard`) | ✅ | ✅ | done |
| 35 — photos override UI | ✅ | ✅ | done |
| 36 — subtitles override UI (refactor → `lockedReelHelpers.jsx`) | ✅ | ✅ | done |
| 37 — slides override UI | ⏳ | ⏳ | **in_progress (implementers en background al pausar)** |

## Estado exacto de feature 37 del front

Implementer corriendo en `run_in_background=true` justo antes de la
pausa. Reporte esperado en `progress/impl_37.md` de este repo.

Para retomar:

1. `ls -la progress/impl_37.md` → si existe y tiene contenido razonable,
   el implementer terminó.
2. Comprobar `progress/current.md` para closing line.
3. `python3 -c "import json; data=json.load(open('feature_list.json')); print(next(f for f in (data.get('features',data) if isinstance(data,dict) else data) if f.get('id')==37)['status'])"` → debe decir `in_progress`.
4. Si está OK → lanzar **reviewer del front** (prompt completo en el
   handoff del back, sección "Reviewer FRONTEND feature 37").

## Primitivos compartidos creados este sprint (NO regresarlos)

- `src/features/defaults/UploadVideoCard.jsx` — refactor de feature 34.
  Consumido por `IntroCard` y `OutroCard` como wrappers thin. Props:
  `{ kind: 'intro'|'outro', agencyId, defaults, refetch, copy }`.
- `src/features/reels/editor/lockedReelHelpers.jsx` — refactor de
  feature 36. Exporta `LockedReelBanner`, `RerenderBadge`,
  `isReelClientLocked`, `LOCKED_COPY`, `LOCKED_WORKFLOW_STATES`.
  Consumido por `PhotosPanel` y `SubtitlesPanel`. **El implementer 37
  debe consumirlo también en `SlidesPanel`**.
- **Pendiente en feature 37**: extraer `useReelDebouncedOverride` (el
  3er call-site lo justifica — política "no pre-factor"). Ya en el
  prompt del implementer.

## Decisiones cross-feature del front

- **Search debounce**: 300ms en reels list (feature 32), 500ms en
  photos/slides PATCH (35/37), 1000ms en subtitles PATCH (36 —
  auto-save sin botón explícito).
- **URL state**: `useSearchParams` de `react-router-dom` (ya en deps,
  no se añadió). Usado en feature 32 para `page`, `page_size`,
  `workflow_state`, `publish_status`, `q`.
- **Métricas del Dashboard**: en feature 32 se colapsaron las 4 cards
  en una "Total reels (current view)" porque server-side pagination no
  permite contar per-status sin requests extra.
- **Brand card**: deshabilitado con tooltip `"Coming soon"` en
  Intro/Outro segmented. Reservado para feature 38+.
- **Memo fix latente** descubierto en feature 35: `useReelImages`
  retornaba un array nuevo en cada render → optimistic updates
  clobbered por `useEffect(setPhotos(livePhotos))`. Fix con
  memoización aceptado por reviewer como bug fix defensivo.

## Tests baseline al pausar

- `npm run test:smoke`: **46 passed / 2 skipped** (baseline estable
  desde feature 32).
- `npm run test:e2e` full: ~303 passed / 2 skipped / 0-2 flakes
  pre-existentes en `social_templates.spec.js` (documentados en
  reviews 33/34/35/36).
- Cuando feature 37 cierre se esperan ~20 specs nuevos del slides
  override.

## Batería de estabilidad pendiente (post-37)

Ver detalle en
`/opt/projects/4Reels-Backend/progress/leader_handoff_2026-05-15.md`
sección "Post-37". Resumen:

- `./init.sh` (lint+build), `npm run test:smoke`, `npm run test:e2e`
  full, bundle analysis (vite output), `git diff --stat` para spot de
  uncommitted del sprint.
- Cross-repo: contrato `DOCS.md` § Backend contract vs `docs/API.md`
  del back para los 6 endpoints (32-37).

## Lo que NO toca el leader

- `src/`, `tests/`, `playwright.config.js`, `vite.config.js`,
  `eslint.config.js`, `package.json` → delegar a implementer.
- Marcar features `done` → lo hace el reviewer.
- `npm install <x>` → veto del CLAUDE.md (blocklist arquitectural).

## Contacto cross-repo

- Repo hermano (back): `/opt/projects/4Reels-Backend`.
- :8001 (test) corre código del back; al cerrar feature 37 sigue
  sirviendo código viejo hasta que alguien reinicie
  `reels-test.service` (requiere sudo, fuera de leader scope).
