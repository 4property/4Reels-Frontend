# Implementer report — feature 30 (social_per_platform_publish_toggle, FRONT)

- **Inicio:** 2026-05-15
- **Agente:** implementer
- **Scope:** `/opt/projects/4Reels-Frontend` — back sin cambios.

## Decisiones UX

### Strip vs grid
Conservé el card horizontal arriba del editor pero reorganizado en dos
niveles:

- Cabecera (icono `share` + título "Publishing networks" + sublinea con
  `{publishingCount} active · {connected} of {total} networks connected`).
  Mantiene la información del antiguo `ConnectionsStrip` sin duplicarla
  abajo.
- **Grid** (`auto-fill, minmax(180px, 1fr)`) con una tarjeta por red. Cada
  tarjeta lleva icono + nombre + estado textual (`Publishing` / `Off` /
  `Not connected`) + el `Switch`. Se descartó el chip horizontal porque
  con 7 redes el toggle no cabía claramente al lado de cada icono y
  perdía accesibilidad táctil en mobile/tablet.

Tarjetas conectadas + ON pintan el borde con `--accent` y fondo
`--accent-soft-2`; conectadas + OFF se quedan neutras; no conectadas
llevan `border-style: dashed` + `opacity: 0.55` para gritar "no se puede
publicar aquí" sin esconder el control.

### Toggle vs Switch component
Reusé el CSS global `.toggle / .toggle.on` de `src/styles/forms.css`
(mismo switch que la pestaña Automation usa vía `src/shared/Toggle.jsx`).
No envolví en el `<Toggle>` JSX existente porque éste empuja un label
arriba que duplicaría el nombre que ya pinto en la tarjeta; en vez de eso
emito un `<button className="toggle ...">` con `aria-pressed` +
`aria-label` propios. Añadí solamente la regla `.toggle:disabled` (no
existía antes; antes nadie deshabilitaba el switch).

### Subtabs atenuadas
Para las plantillas, en cada subtab desactivada por publish añado clase
`disabled-publish` (`opacity: 0.55`) y un badge inline `Off`
(`.subtab-off-badge`) tras el nombre. La subtab sigue **clickable**: el
usuario puede preparar la plantilla aunque hoy no publique. La regla
`.subtab.disabled-publish.active` restaura `opacity: 1` para que la
subtab activa nunca se vea apagada (eliminé el "limbo visual" de la
subtab activa medio gris).

## Shape del PUT body

Helper `buildPlatformsOnlyDefaultsBody(reelDefaults, platforms)`. Echo
los campos que el back tratará como reemplazo (`intro_enabled`,
`duration_seconds`, `platforms`) y reenvío el `settings` blob completo
para no perder lo que otras pestañas hayan guardado:

```json
{
  "intro_enabled": true,
  "duration_seconds": 30,
  "platforms": ["instagram", "facebook", "linkedin", "youtube", "gbp", "pinterest"],
  "settings": { /* GET /defaults.settings tal cual */ }
}
```

Si `reelDefaults` todavía no ha cargado (mutación rápida o agency sin
fila persistida) caigo a `intro_enabled: true`, `duration_seconds: 30`,
sin `settings`. La función guarda el invariante de que **sólo
`platforms` cambia**; el resto del defaults se preserva.

## Hidratación del Set mientras `useReelDefaults` está cargando

El `useState` inicial arranca con `new Set(DEFAULT_PLATFORMS)` (las 7
canonicales tras feature 19 del back). Cuando `useReelDefaults()`
resuelve con `defaults.platforms` no vacío, sobrescribo el Set con el
valor persistido. Decisión documentada en el `useEffect`: ignoro
`platforms === []` porque la fila vacía es un quirk del mock — el back
ya ship con `DEFAULT_PLATFORMS` sembrado en cuanto la agencia existe, y
respetar `[]` aquí dejaría todos los toggles en off al primer load para
agencias recién creadas en el mock. Edge case "el usuario desactiva
todas las redes y recarga" queda con UX defaulteando a las 7 (asumimos
que no es un estado que el usuario quiera memorizar). El comentario lo
explica al siguiente lector.

## Test plan / verificación

### Tests añadidos

`tests/social_publish_toggles.spec.js` — 5 escenarios × 3 viewports = **15 runs**:

1. `flipping TikTok off sends PUT with platforms minus tiktok` — verifica
   shape exacta del body (platforms sin `tiktok`, intro_enabled boolean,
   duration_seconds number, settings definido).
2. `reload re-hydrates toggles from persisted defaults.platforms` — PUT
   off → `page.reload()` → toggle sigue off, otros siguen on.
3. `flipping TikTok back on sends PUT including tiktok` — seed sin tiktok,
   click ON, verifica body incluye `tiktok`.
4. `disconnected social yields a disabled toggle and no PUT fires` —
   pinterest no conectada → toggle `disabled`, tooltip "Connect this
   network first", `click({force:true})` no produce PUT.
5. `template subtab for an off-publish network is attenuated` — toggle
   off TikTok → subtab tiene clase `disabled-publish` + badge Off; sigue
   clickable.

### Mock backend

`tests/support/mock-backend.js`:

- Nuevo `options.socialAccountsByAgency` para sembrar cuentas conectadas
  por plataforma. Si no se pasa, conserva el comportamiento anterior
  (`items: [], connected: false`).
- Nuevo `options.defaultsByAgency` para pre-poblar el row de
  `/defaults`. Útil para sembrar `platforms` antes del primer GET.
- El handler PUT `/defaults` ya aceptaba `platforms` (preexistente,
  feature 24); no fue necesario cambiarlo. El round-trip `[].platforms`
  sale del shallow-merge `{...previous, ...body}` que ya estaba.

### Comandos

```
$ ./init.sh                                              # OK (lint+build)
$ npm run lint                                           # OK
$ npm run build                                          # OK (CSS 125.78 kB)
$ npm run test:smoke                                     # 46 passed / 2 skipped
$ npx playwright test tests/social_publish_toggles.spec.js
                                                          # 15 passed
$ npx playwright test tests/social_templates.spec.js     # 30 passed
                                                          # (1 flake en primera
                                                          # corrida, verde al
                                                          # rerun — flake
                                                          # preexistente
                                                          # registrado en
                                                          # current.md hotfix 3)
$ grep -rnE '\bfetch\(' src/features/social/             # 0 hits
```

## Archivos tocados

- `src/features/social/SocialConfig.jsx` — `PublishingStrip`,
  `togglePublish`, hidratación, `buildPlatformsOnlyDefaultsBody`,
  subtabs con `disabled-publish` + badge Off.
- `src/features/social/styles.css` — `.publishing-strip`,
  `.publishing-grid`, `.publishing-card[.on|.disconnected]`,
  `.publishing-card-*`, `.toggle:disabled`,
  `.template-net-tabs .subtab.disabled-publish[.active]`,
  `.subtab-off-badge`.
- `tests/support/mock-backend.js` — nuevas opciones
  `socialAccountsByAgency` y `defaultsByAgency`; el handler de
  `social-accounts` ahora atiende seed; `defaultsByAgency` se hidrata en
  el Map antes del primer GET.
- `tests/social_publish_toggles.spec.js` — NUEVO, 5 escenarios.
- `progress/current.md` — bitácora actualizada.

## NO done

Feature **no marcada** como `done` en `feature_list.json`. Espera al
reviewer.
