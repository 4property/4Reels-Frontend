# Implementacion - feature 2 (align_music_endpoint_front_to_back)

## Cambios

- `src/features/music/api.js` consume `/v1/admin/agencies/{id}/music` y expone
  `registerTrack`, `listTracks`, `inspectTrack`, `reconfigureTrack`,
  `decommissionTrack`.
- `src/features/music/hooks.js` expone hooks para lectura y mutaciones con
  `useApi`/`useMutation`.
- `MusicConfig.jsx`, `MusicLibrary.jsx`, `MusicRules.jsx` y `music.css` usan
  el shape canonico del backend: `music_id`, `display_name`, `object_key`,
  `duration_seconds`, `is_default`, `created_at`.
- `tests/support/mock-backend.js` sirve CRUD in-memory para `/music` y ya no
  devuelve `{implemented:false}`.
- `tests/music.spec.js` cubre lista, create, edit y delete.
- `DOCS.md` documenta el contrato real de Music.

## Verificacion

- `npm run lint --silent`: verde.
- `npm run build --silent`: verde.
- `npm run test:smoke`: `40 passed`, `2 skipped`.
- `npx playwright test music.spec.js`: `3 passed`.
- `npm run test:e2e`: `43 passed`, `2 skipped`.
- `rg -n "music-tracks" src tests`: 0 hits.

## Nota entorno

`bash ./init.sh` no arranca en este Windows porque falta `/bin/bash`; se uso
su equivalente PowerShell (`node`, `npm`, validacion JSON, lint, build).
