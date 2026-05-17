# Explore: email notifications (frontend) — 2026-05-14

## TL;DR

`reviewEmails` hoy es un **string CSV** en
`defaults.settings['automation.reviewEmails']`, renderizado como un
`<input>` plano en `src/features/automation/ReviewModeDetails.jsx:22`.
Solo viaja a `/defaults` (en `/automation` es forbidden key del back).
Sin validación de email. El patrón reusable más cercano para chips
multi-valor es el `HashtagsEditor` introducido en feature 20
(`src/features/social/SocialConfig.jsx:466-566`): commit con Enter/coma/
espacio, normalización, dedup, errores inline, cap configurable.

## 1. Estado actual de reviewEmails

- **UI**: `src/features/automation/ReviewModeDetails.jsx:22` —
  `<input value={reviewEmails} ... />` con hint "Comma-separated".
- **State**: `src/features/automation/AutomationConfig.jsx:36` —
  `const [reviewEmails, setReviewEmails] = useState('')`.
- **Hidratación**: `AutomationConfig.jsx:78` —
  `setReviewEmails(settings[AUTOMATION_SETTINGS_KEYS.reviewEmails] || '')`.
- **Persistencia**: `useAutomationSave.js:79` mergea en
  `defaults.settings['automation.reviewEmails']` y hace PUT a `/defaults`.
- **Shape**: string CSV `"a@x.com, b@y.com"`.
- **Validación**: ninguna. Input crudo → BBDD.

## 2. UI de multi-input (chips/lista)

**Patrón reusable existe**: `HashtagsEditor` en
`src/features/social/SocialConfig.jsx:466-566`. Cubre:
- Render de chips con botón × para borrar (líneas 534-545).
- Input inline auto-focus respetando `disabled` (547-557).
- Normalizer custom (`normaliseHashtag`, 470-486) — para emails sería
  `trim() + lowercase()`.
- Validación contra regex importada (línea 474) — para emails sería
  `EMAIL_PATTERN`.
- Dedup silencioso (478).
- Multi-trigger commit: Enter, coma, espacio, Backspace-borra-último
  (488-504).
- Error inline danger-banner (559-562).
- Cap visible (`MAX_HASHTAGS_PER_PLATFORM`, 468/471/554-555).

**No existe componente compartido genérico** tipo `<ChipInput>`. Opciones:
- (A) Extraer la lógica común a `src/shared/ChipInput.jsx` y especializar
  para emails y hashtags. Más limpio pero requiere refactor de
  `HashtagsEditor`.
- (B) Copiar el patrón inline para emails en `src/features/automation/
  EmailListInput.jsx`. Más rápido pero duplica código.

**Recomendación**: (B) para MVP; refactor a (A) cuando aparezca un
tercer consumidor.

## 3. Validación de email

**No existe helper** en `src/lib/utils/` (solo `format.js` y `template.js`).

**A añadir** en `src/lib/utils/email.js`:
```js
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(value) { return EMAIL_PATTERN.test(value); }
export function normaliseEmail(raw) { return String(raw || '').trim().toLowerCase(); }
```

Patrón coherente con `src/features/social/constants.js:HASHTAG_PATTERN`.

## 4. Ubicación de la UI

**Recomendación**: `/automation`, dentro de `ReviewModeDetails`
(donde está hoy). Razones:
- `reviewEmails` es semánticamente parte del modo "review-first".
- Mantener la config junta minimiza saltos de pestaña.
- No tiene sentido en `/admin` (sobrecarga el drawer) ni `/social`
  (no es template-related).

## 5. Mock backend actual

- **`/automation` handler** (`tests/support/mock-backend.js:1095-1103`):
  `review_emails` está en `FORBIDDEN_KEYS` → PUT con esa key → 422.
- **`/defaults` handler** (`tests/support/mock-backend.js:854-943`):
  GET devuelve `stored` con `settings` opaco. PUT mergea
  `settings.*` literalmente. **Acepta `settings['automation.reviewEmails']`
  sin validación**.

## 6. Decisiones pendientes

1. **Shape en la UI**: ¿array de strings (`['a@x', 'b@y']`) en state +
   join CSV al guardar (compat), o cambiar el back a `list[str]`
   nativo? Recomendado: front en array; al guardar, JSON-serialize
   directo (back acepta `list[str]` per la decisión del back doc).
2. **Email regex**: permisivo `^[^\s@]+@[^\s@]+\.[^\s@]+$` MVP, no
   RFC5322 estricto.
3. **Lowercase silencioso**: dedup estable. Decidir si avisar al
   usuario.
4. **Cap**: ¿límite de N emails por agencia? Sugerencia: soft warning
   a partir de 10, sin hard cap.
5. **Chip placeholder**: ¿iconito de envelope? ¿Sin icono, solo el
   email + ×?

## 7. Gaps

- Sin helper `lib/utils/email.js` — crear.
- Sin componente compartido de chips; `HashtagsEditor` está
  feature-locked en `/social`.
- Sin gating de validación en el state actual: PUT con garbage pasa.
- Sin spec E2E del flujo de emails. Plantilla: `tests/automation_scheduling.spec.js`.
- Mock-backend `/defaults` acepta opaco; al cambiar a `list[str]` hay
  que extender el handler para validar el shape y emitir 422.

## 8. Archivos clave referenciados

- `src/features/automation/ReviewModeDetails.jsx:22` (input actual).
- `src/features/automation/AutomationConfig.jsx:36,78,102` (state + hidratación + save).
- `src/features/automation/useAutomationSave.js:79` (merge a defaults.settings).
- `src/features/defaults/initialState.js:22,32` (clave + default).
- `src/features/social/SocialConfig.jsx:466-566` (HashtagsEditor pattern).
- `src/features/social/constants.js` (HASHTAG_PATTERN modelo).
- `tests/support/mock-backend.js:854-943,1095-1103` (handlers).
- `src/app/pages.js` (routing).
