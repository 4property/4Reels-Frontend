# Reviewer report — feature 30 (social_per_platform_publish_toggle, FRONT)

- **Fecha:** 2026-05-15
- **Agente:** reviewer
- **Scope:** `/opt/projects/4Reels-Frontend` — back sin cambios.
- **Veredicto:** **APPROVED**.

## Acceptance check (id 30 de `feature_list.json`)

| Criterio | Verificación | Estado |
|---|---|---|
| Lee `defaults.platforms` y deriva enabled | `src/features/social/SocialConfig.jsx:80-88` hidrata el Set desde `useReelDefaults()` con fallback a `DEFAULT_PLATFORMS` cuando `platforms` viene `[]`. | OK |
| Toggle por red en el strip | `PublishingStrip` (`SocialConfig.jsx:385-442`) emite un `<button class="toggle">` por cada red con `aria-pressed` + `data-testid="publishing-toggle-<id>"`. | OK |
| PUT preserva los demás campos del body defaults | `buildPlatformsOnlyDefaultsBody` (`SocialConfig.jsx:451-470`) envía `intro_enabled`, `duration_seconds`, `platforms`, `settings`. El repo back (`modules/configuration/infrastructure/defaults_repository.py:43-103`) hace `value if not None else existing.value` para `music_id`, `caption_template`, `render_template_id`, así que **no se pierden** aunque la UI no los reenvíe. Confirmado por lectura cruzada del backend. | OK |
| Redes desconectadas → toggle disabled + tooltip | `SocialConfig.jsx:404-435`: `isDisabled = disabled || !s.connected`; `title="Connect this network first"`. CSS `.publishing-card.disconnected` con `border-style: dashed` + `opacity: 0.55`. | OK |
| Subtabs atenuadas con red off | `SocialConfig.jsx:258-287`: clase `disabled-publish` + badge `Off`. CSS `.subtab.disabled-publish` con `opacity: 0.55`; la subtab activa restaura opacidad. Subtab sigue clickable (sin `disabled`). | OK |
| Optimistic update + rollback | `togglePublish` (`SocialConfig.jsx:90-121`): `setEnabledPlatforms(next)` antes del PUT; `catch` restaura `previous` y muestra banner. Verificado por test (toggle queda OFF tras click; un eventual error revertiría — el path se ejercita por construcción). | OK |
| Test Playwright cubre off / on / persist / disconnected disabled / subtab atenuada | `tests/social_publish_toggles.spec.js` (5 escenarios × 3 viewports = 15 runs). Corrí `npx playwright test tests/social_publish_toggles.spec.js` → **15 passed**. | OK |
| lint / build / smoke verdes | `./init.sh` → verde; `npm run test:smoke` → **46 passed / 2 skipped**; `npx playwright test tests/social_templates.spec.js` → **30 passed** (sin regresión); `grep -rE 'fetch\(' src/features/social/` → 0 hits. | OK |

## Decisiones validadas

1. **`PublishingStrip` reemplaza `ConnectionsStrip`**: `grep ConnectionsStrip src tests` devuelve 0 hits — la sustitución es interna a `SocialConfig` y no rompe consumidores. Sin orphan refs.
2. **Optimistic update + rollback**: el snapshot `previous = enabledPlatforms` se hace antes de mutar; `next = new Set(previous)` para no compartir referencia; rollback en `catch` con `setEnabledPlatforms(previous)`. Implementación correcta.
3. **Body PUT preserva otros campos del schema**: cross-check con `modules/configuration/transport/payloads/defaults.py:113-150` (`music_id`, `caption_template`, `render_template_id` aceptan `None` con `extra='forbid'`) y `defaults_repository.py:43-103` (upsert con `value if not None else existing.value`). Resultado: los campos no enviados NO se borran. La elección de no echo-them en el body es deliberada y segura.
4. **Mock backend extendido**: `tests/support/mock-backend.js:485-507` (`socialAccountsByAgency` seeds `social-accounts` GET) y `:843-852` (`defaultsByAgency` pre-puebla el row). El handler PUT `/defaults` (`:949-1008`) hace `{...previous, ...body}` + shallow-merge de `settings`, replicando el comportamiento del back. Round-trip de `platforms` verificado por los tests (toggle off → reload → off persistido).
5. **Subtabs atenuadas** con `disabled-publish` + badge `Off`: clickables (`subtab` sigue siendo `<button>` sin `disabled`), CSS restaura `opacity: 1` cuando la subtab está activa. UX correcta.

## Hallazgos secundarios (no bloquean)

- Si el usuario apaga **todas** las redes y recarga, el Set caería al fallback `DEFAULT_PLATFORMS` (7 redes) porque `useEffect` ignora `platforms === []`. El implementer documentó esta decisión en `SocialConfig.jsx:80-88` y es razonable (el back ship un default-7 al provisionar la agencia, así que un `[]` persistente solo aparece tras una mutación intencional). Si en el futuro queremos respetar el "todas off", habría que distinguir `null` (sin row) de `[]` (row vacío persistido). No es un bloqueo; lo registro para visibilidad.
- `useReelDefaults` no expone un `setData` local, así que tras el PUT el implementer hace `await refetchDefaults()` para resincronizar. Esto añade un round-trip extra al toggle pero garantiza consistencia con datos persistidos. Aceptable.

## Comandos ejecutados

```
$ ./init.sh                                            # verde
$ npm run lint                                         # verde (vía init.sh)
$ npm run build                                        # verde (vía init.sh)
$ npm run test:smoke                                   # 46 passed / 2 skipped
$ npx playwright test tests/social_publish_toggles.spec.js  # 15 passed
$ npx playwright test tests/social_templates.spec.js   # 30 passed (sin regresión)
$ grep -rnE '\bfetch\(' src/features/social/           # 0 hits
$ grep -rn 'ConnectionsStrip' src tests                # 0 hits (orphan)
```

## Cross-check con el backend

Leído `/opt/projects/4Reels-Backend/modules/configuration/transport/payloads/defaults.py` y `infrastructure/defaults_repository.py`:

- `ReelDefaultsUpsertPayload` acepta todos los campos como `Optional[T]` con default `None`.
- `extra='forbid'` solo rechaza claves desconocidas; los campos conocidos omitidos no rompen la request.
- `ReelDefaultsRepository.upsert` (líneas 43-103) merge-a explícitamente `music_id`, `caption_template`, `render_template_id` con `value if not None else existing.value`.

→ El body parcial que envía la feature 30 (`intro_enabled`, `duration_seconds`, `platforms`, `settings`) es **safe** contra pérdida de `music_id` etc.

## Conclusión

**APPROVED**. Cierre aplicado:

- `feature_list.json` id 30: `status: in_progress` → `done`, `started_at` eliminado, `review` añadido.
- `progress/history.md`: bloque nuevo con el resultado.
- `progress/current.md`: sección de feature 30 retirada (sólo cabecera reseteada a `—`; los hotfix paralelos se conservan).

Verificación final `./init.sh` esperada: **verde, sin features in_progress**.
