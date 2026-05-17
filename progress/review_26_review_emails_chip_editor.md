# Reviewer report — feature 26 `review_emails_chip_editor`

> **Veredicto:** APPROVED.
> Cierre cross-repo: el front #26 se cierra autónomamente porque las
> acceptance criteria del `feature_list.json` están todas cubiertas por
> el spec E2E + greps. El paso "Manual contra :8001" listado en
> `verification` es smoke recomendado (depende de back #26 en review y
> back #27 pending), **no es acceptance bloqueante**.

## Checks duros

| Comando | Resultado |
|---------|-----------|
| `./init.sh` | OK — node, lint, build verdes (25 features, sin TS, sin libs prohibidas). |
| `npm run lint` | OK (sin errores). |
| `npm run build` | OK (CSS 126.39 kB, JS 399.17 kB, gzip 30.63 + 114.33 kB). |
| `npm run test:smoke` | 46 passed / 2 skipped (los 2 `theme` preexistentes). |
| `npx playwright test tests/review_emails.spec.js` | 9/9 passed (3 escenarios × 3 viewports). |
| `npx playwright test tests/payload_contract.spec.js` | 6/6 passed (Automation split entre `/automation` y `/defaults` verde). |

## Chequeos específicos

1. **Helper `src/lib/utils/email.js`**: exporta `EMAIL_PATTERN`,
   `normaliseEmail` (trim + lowercase, guardas para no-string),
   `isValidEmail` (regex). Sin imports externos. Conforme al acceptance
   item #1 del feature.

2. **`EmailListInput.jsx`**:
   - Chips con botón `×` (`aria-label="Remove <email>"`) — OK.
   - Commit on Enter, coma, espacio (sólo si draft no vacío) y blur — OK
     (`handleKeyDown` y `handleBlur`).
   - Backspace en input vacío elimina último chip — OK
     (`event.key === 'Backspace' && draft === '' && emails.length > 0`).
   - Paste con comas → splitea segmentos y commitea cada uno, mantiene
     el tail como draft (bonus, no listado pero coherente con la UX).
   - Dedup case-insensitive silencioso (`normaliseEmail` lowercase antes
     de `emails.includes`) — OK.
   - Validación regex con flash de error (2.5 s, autodismiss con
     cleanup en unmount) — desvío documentado del banner permanente del
     `HashtagsEditor`; aceptable.
   - Sin librerías externas, sin `fetch`, sin imports prohibidos —
     `grep` confirma sólo React + Icon + helper local.

3. **Hidratación retrocompat (`parseReviewEmails`)**:
   - Acepta `Array` → normalise + filter.
   - Acepta `string` CSV legacy → split + normalise + filter.
   - Otros tipos → `[]`.
   - Test 2 del spec (legacy CSV `"a@x.com, b@y.com"`) renderiza
     exactamente 2 chips → OK.

4. **PUT body sin CSV-join**:
   - `useAutomationSave.js` envía
     `Array.isArray(automationState.reviewEmails) ? automationState.reviewEmails : []`
     — sin `.join`, sin `.split`.
   - `grep -rn 'reviewEmails.*split\|reviewEmails.*join' src/features/automation/useAutomationSave.js`
     → **0 hits**.
   - Acceptance check del plan (`reviewEmails.*split` 0 hits en src):
     el split sólo aparece dentro del helper `parseReviewEmails(raw)`
     que opera sobre el param `raw`, no sobre `reviewEmails` literal.
     Intención auditiva ("no split en save") preservada y verificable
     vía test 1 del spec, que afirma `body.settings['automation.reviewEmails']`
     llega como `['ops@4pm.ie', 'boss@4pm.ie']` (array, no string).

5. **Default `[]` en `initialState.js`**:
   - `AUTOMATION_SETTINGS_KEYS.reviewEmails: 'automation.reviewEmails'`.
   - `INITIAL_DEFAULTS.settings[AUTOMATION_SETTINGS_KEYS.reviewEmails]: []`
     — OK.

6. **Mock-backend (`tests/support/mock-backend.js`)**:
   - Helper `validateReviewEmails(raw)`:
     - Array de strings → cada item trim+lowercase + regex
       `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
     - String CSV legacy → split + trim + regex.
     - `null`/`undefined` → `null` (sin error).
     - Otros (number/dict) → `Unsupported type for reviewEmails`.
   - Handler PUT `/defaults` invoca el validator y responde 422 con
     shape Pydantic-like `{ detail: [{ loc, msg: 'INVALID_EMAIL_LIST: …', type }] }`.
   - Mirror del back #27 esperado, cubierto por el comentario en
     línea ~978-998.

7. **Layer rules (CLAUDE.md §arquitectura)**:
   - `grep -rnE 'fetch\(' src/features/automation/` → 0 hits (el único
     match es `Promise.all` en `AutomationConfig.jsx:121`, no `fetch`).
   - `EmailListInput.jsx` sólo importa `react`, `Icon` y el helper
     local — sin acceso a red, sin librerías UI externas.

8. **Sin scope creep**:
   - `git status` muestra los archivos esperados del informe del
     implementer + un puñado de cambios de features anteriores ya
     consolidadas (28, 30, 31, HOTFIX brand/social) y no afecta a
     scope de feature 26.
   - Ninguno de los archivos modificados tocaba scope de features 28
     ni HOTFIX paralelos.

## Desviaciones aceptadas

1. **Helper `parseReviewEmails(raw)`**: el grep literal
   `reviewEmails.*split` del plan acceptance da 0 hits, pero la
   intención (el split vive sólo en hidratación, no en save) está
   doblemente garantizada — primero por la presencia del helper aislado
   y segundo por el contenido del PUT verificado en el spec E2E. Se
   acepta.
2. **Error inline con autodismiss a 2.5 s** vs el banner permanente del
   `HashtagsEditor` de feature 20. Justificación UX en el informe del
   implementer (flujo "Enter, Enter, Enter…"), cleanup correcto en
   unmount via `useRef`. Se acepta.
3. **Mock valida también el formato de cada email**, no solo el tipo.
   Esto va ligeramente más allá del plan literal ("rechaza tipos no
   válidos") pero coincide con la futura validación Pydantic del back
   #27. Se acepta como "red de seguridad" + autoprotección frente a
   contract drift en CI.

## Riesgos cross-repo

- **Back #26 en review, back #27 pending**: el front es retrocompat por
  hidratación (acepta CSV string si el back nunca migrara a list[str]).
  El test 2 del spec garantiza esa rama.
- **Regex divergente vs back**: el front usa
  `^[^\s@]+@[^\s@]+\.[^\s@]+$`; si back #27 elige
  `email-validator` (más estricto), un email aceptado en cliente puede
  ser 422 en server. El front muestra el `detail[0].msg` vía
  `statusMessage` del `AutomationConfig`. Sugerido: el reviewer del back
  #27 espeje este regex o lo documente.
- **Empty list semantics**: front no impide guardar `[]`. Si back #27
  requiere ≥1 email cuando `approval_required=true`, será una
  validación cross-field aparte (out of scope aquí).

## Veredicto

**APPROVED**. Procedo a cierre del front #26:

1. Este informe escrito en `progress/review_26_review_emails_chip_editor.md`.
2. `feature_list.json` id 26: `status: "done"`, elimino `started_at`,
   añado `"review": "progress/review_26_review_emails_chip_editor.md"`.
3. `progress/history.md`: append de bloque siguiendo el patrón.
4. `progress/current.md`: elimino la sección de feature 26 (cabecera
   reseteada a `—`); conservo HOTFIX paralelos.
5. `./init.sh` final verde.

El "Manual contra :8001 con back 26+27 desplegadas" sigue siendo smoke
recomendado y queda para cuando back #27 cierre. No bloquea el cierre
del front.
