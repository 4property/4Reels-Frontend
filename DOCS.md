# 4Reels — Product docs

Multi-tenant SaaS that generates vertical reels (3:4 / 9:16) from real-estate listings, publishes them to social networks, and tracks the traffic they drive. Integrates with **GoHighLevel** and **WordPress** as listing sources.

The current frontend talks to the live backend contract through `src/lib/api/client.js`. Playwright tests provide deterministic backend responses with route stubs in `tests/support/mock-backend.js`.

## End-to-end flow

```
New property (GHL / WP)
  → Ingestion → AI photo selection + subtitles + per-network copy
  → Render (MP4 with music, intro/outro, watermark, subs)
  → Auto-publish OR email review
  → Link tracking (views, clicks, CTR per network)
```

## Tenant model

A tenant is one agency. Each has: plan + MRR, seats with roles, two data sources (GHL + WP), music library, brand, render defaults, connected social networks, team with per-module permissions.

## Pages

### Dashboard — `features/reels/`
Reels list with grid/list toggle. Cards show 3:4 video preview, status, networks, link tracker (views/clicks/CTR with 7d/30d sparkline). Filters: All / Needs approval / Published / Rejected.

### Reel editor — `features/reels/editor/`
Full-screen editor opened from a card. Left: live 3:4 preview with scene scrubber. Right: 5 tabs.

- **Photos** — grid with AI scores, click to select, drag to reorder, re-run AI, upload.
- **Subtitles** — AI lines with editable start/end + text. Regenerate or add lines.
- **Descriptions** — one per network (IG, TikTok, YT, FB, LinkedIn, GMB) with per-network char limits, `{{variables}}`, and live preview.
- **Slides** — extra slides between photos: intro, outro, Google review, text slide, photo slide. Each has duration + reorder.
- **Voiceover** — *Record* mode (mic, takes list with waveform) or *AI voice* mode (6 voices, script from subtitles). Shared mix sliders: voice, music, ducking.

Header actions: Regenerate with AI, Export, Publish.

### Music — `features/music/`
- **Library**: real CRUD against `/v1/admin/agencies/{id}/music`.
  Tracks use `music_id`, `display_name`, `object_key`, `duration_seconds`,
  `is_default`, `created_at`.
- **Selection rules**: default-track pool based on `is_default`, with full
  library fallback when no default track exists.

### Social — `features/social/`
Per-network description templates with `{{variables}}` and live preview. Shows connected networks with handles and char limits, including Pinterest when GoHighLevel returns a connected Pinterest account.

### Brand — `features/brand/`
Identity (logo, colors, heading font) and logo placement on every reel
frame. Live 3:4 preview reacts to changes. The PUT body matches the
`BrandSettingsUpsertPayload` schema exactly: `primary_color`,
`secondary_color`, `logo_position`, `font_family`, optional
`logo_object_key` / `intro_logo_object_key`.

### Defaults — `features/defaults/`
Render defaults applied to every new reel (overridable per reel). Six sub-tabs: Format & locale, Subtitles style, Video & timing, Intro & outro, Audio, Caption generation.

### Automation — `features/automation/`
Two mutually-exclusive modes:
- **Publish automatically** — hold window, quiet hours, skip weekends, default networks.
- **Review by email** — email to a recipient list with 1-click Approve / Edit / Reject.

Shared: auto-generate subtitles, re-render on upstream data changes.

The page persists across two endpoints (composed in `useAutomationSave`):
- `PUT /v1/admin/agencies/{id}/automation` carries the canonical
  `AutomationRulesUpsertPayload` slice. After back feature 13 / front
  feature 16 this slice owns the scheduling toggles:
  - `approval_required` (derived from `publishMode`).
  - `trigger_on_status`.
  - `hold_window_seconds: int` (0..86400, `0` ≡ no hold).
  - `quiet_hours_enabled: bool` + `publish_window_start` /
    `publish_window_end` (`"HH:MM"`). The UI captures the *silent*
    range (e.g. `22:00 → 07:00`); the body inverts it into the
    *allowed* range (`publish_window_start = "07:00"`,
    `publish_window_end = "22:00"`). The back's
    `compute_next_publish_slot` interprets times in agency-local TZ
    (`agencies.timezone`).
  - `skip_weekends: bool` + `publish_days: string[]`
    (`["mon".."fri"]` when skip is on, `["mon".."sun"]` when off).
- `PUT /v1/admin/agencies/{id}/defaults` owns the `platforms` array
  and the remaining toggles (captions / regen on update / review
  emails) under `settings` with namespaced keys
  (`automation.autoCaptions`, `automation.regenOnUpdate`,
  `automation.reviewEmails`). The back's `defaults.settings` is jsonb
  and the back replaces it on PUT, so the hook reads the existing
  `settings` first and shallow-merges before saving. The legacy
  `automation.quietHoursEnabled` / `.skipWeekends` /
  `.reviewWindowEnabled` / `.reviewWindowHours` keys are stripped on
  save during the front feature 16 migration.

### Admin — `features/admin/`
Super-admin view. Platform metrics + agencies table. Click a row → drawer with three tabs:
- **Sources** — GHL (Location ID + token, test connection) and WordPress (URL + Application Password, polling interval).
- **Billing** — plan, MRR, seats, next invoice. Open in Stripe.
- **Activity** — event log.

Invite-agency modal from header.

**Team & permissions** (`admin/team/`) — security policy (2FA, SSO, session timeout), members table, role permissions matrix (Admin / Editor / Viewer × modules). Implemented but not yet wired into navigation.

### Notifications — `features/notifications/`
Modal from the topbar bell. Channels (Email / Slack / SMS), per-recipient event subscriptions (needs approval, published, failed render), delivery frequency (instant / hourly / daily digest).

## Data model

The backend contract is represented by the feature `api.js` modules and the Playwright route stubs.

| Entity | Key fields |
|---|---|
| `agency` | name, tenantId, plan, logo, color |
| `socials[]` | id, name, connected, handle (`instagram`, `tiktok`, `facebook`, `linkedin`, `youtube`, `gbp`, `pinterest`) |
| `reels[]` | id, title, address, price, status, publishStatus, scenes, music, kind, type, networks[], tracker |
| `tracks[]` | music_id, agency_id, display_name, object_key, duration_seconds, is_default, created_at |
| `variables[]` | `{{tag}}` catalog |
| `tenants[]` | agencies (super-admin) |
| `team[]` | members with role, 2FA, SSO |
| `roles[]` | Admin / Editor / Viewer with permission matrix |

## Backend contract

What the real backend must implement:

- **Reels list pagination + filters** (feature 32) — `GET
  /v1/admin/agencies/{id}/reels?page=&page_size=&workflow_state=&publish_status=&q=`.
  - All query params are optional. `page` defaults to `1`; `page_size` to
    `25`. `workflow_state` / `publish_status` accept a single value OR a
    comma-joined list (multi-select). `q` is searched server-side over
    title, slug AND property reference (source property id), case-insensitive.
  - Response shape:
    `{ items: AgencyReelSummary[], count_total: int, page: int,
       page_size: int, has_more: bool, count: int }`.
    `count` is a legacy alias for `len(items)` preserved for backcompat
    with the pre-32 shape `{ items, count }`. New consumers should use
    `count_total` for "global total under the current filter" and
    `has_more` for the pagination button gating.
  - The frontend resets `page` to `1` on any filter / `q` / `page_size`
    change; only the pagination buttons mutate `page`. The full UI state
    (page, page_size, workflow_state, publish_status, q) lives in the URL
    search params so that links are shareable and the back button works.
- **Auth** —
  - `POST /v1/sessions/gohighlevel/session` returns
    `{ agency_token, agency_token_expires_at, ... }` when the location
    is connected (`connected:true` + `agency_id`). The frontend stores
    `agency_token` in `sessionStorage` (`4reels.adminBearer`) via
    `src/lib/api/authToken.js` and `apiRequest` attaches it as
    `Authorization: Bearer <token>` to every `/v1/admin/*` call.
  - If the location is not yet connected, the response omits both
    fields and the connect screen stays up.
  - 503 `AGENCY_AUTH_NOT_CONFIGURED` means the backend is missing
    `ADMIN_AGENCY_TOKEN_SECRET`. The frontend renders an explicit
    "Backend admin auth not configured — contact ops" notice rather
    than a generic error.
  - Super-admins use the local connect screen (under
    `VITE_MVP_ADMIN_ENABLED`) to paste an `ADMIN_API_TOKEN`. The token
    is held in `sessionStorage` only — never persisted in env or
    bundled. **Never** introduce a `VITE_ADMIN_API_TOKEN` env var:
    `VITE_*` values are inlined into the public JS bundle.
  - 401 on any `/v1/admin/*` call clears the cached bearer and bounces
    the user back to the connect screen. There is no refresh today —
    the user reconnects the GHL session or repaste the bearer.
- **Ingestion** — GHL via Private Integration Token + Location ID; WordPress REST + Application Password.
- **Music** — CRUD at `/v1/admin/agencies/{id}/music`; no `/music-tracks` stub.
- **Social templates** — read/replace at
  `/v1/admin/agencies/{id}/social-templates`. The Admin drawer's
  Descriptions subtab and the agency-facing Social tab both consume this
  pair. Contract:
  - `GET` → `{ agency_id, templates: {platform: descriptionString}, items: [{agency_id, platform, description_template, title_template, hashtags[], created_at, updated_at}], count }`.
  - `PUT` body: `{ templates: {platform: descriptionString} }` (extra='forbid').
    Replaces the whole block. Send an empty `templates` object to drop
    every stored template. `title_template` and `hashtags` are read-only
    via this endpoint today.
- **Brand logo upload** — multipart upload at
  `POST /v1/admin/agencies/{id}/brand/logo`. The Brand tab calls this
  when the user picks a JPG/PNG, then issues `PUT /brand` to persist the
  returned `logo_object_key`. Contract:
  - Request: `multipart/form-data` with a single `file` part (JPG or PNG,
    max 5 MB enforced client-side; the backend remains the source of
    truth on actual limits).
  - Response 200: `{ object_key: string, url: string }`. `object_key` is
    the canonical key the frontend echoes back via `PUT /brand`. `url` is
    used for the in-app preview.
  - The companion `PUT /v1/admin/agencies/{id}/brand` accepts
    `logo_object_key` and `intro_logo_object_key` as strings. The columns
    `agency_brand_settings.logo_object_key` /
    `agency_brand_settings.intro_logo_object_key` are `Text NOT NULL
    DEFAULT ""`. Sending `""` clears the slot (this is how "Remove logo"
    works); sending `null` is interpreted as "do not touch this field".
    The rest of the BrandSettingsUpsertPayload contract is unchanged
    (`primary_color`, `secondary_color`, `logo_position`, `font_family`,
    extra='forbid' on every other key).
- **Agency outro upload** (feature 33) — multipart upload, signed
  retrieval and delete for the per-agency outro clip that the renderer
  stitches at the end of every reel. The Defaults > Intro & outro card
  drives these endpoints:
  - `POST /v1/admin/agencies/{id}/outro/upload` — request:
    `multipart/form-data` with a single `file` part (MP4 or MOV,
    max 50 MB and 1–10 s enforced both client-side and server-side via
    ffprobe). Response 200: `{ outro_object_key: string,
    outro_duration_seconds: number, outro_source: "uploaded" }`.
    Documented server errors: 422 `INVALID_MIME`,
    413 `FILE_TOO_LARGE`, 422 `INVALID_DURATION`.
  - `GET /v1/admin/agencies/{id}/outro/file` — bytes of the persisted
    clip (`Content-Type: video/mp4` or the original mime). Requires the
    same admin bearer as the rest of `/v1/admin/*`, so a plain
    `<video src>` only works through the Playwright mock; production
    callers must fetch through `defaultsApi.outroDownload` (blob +
    `URL.createObjectURL`).
  - `DELETE /v1/admin/agencies/{id}/outro` — clears the persisted file
    and returns `{ outro_source: "none", outro_object_key: null }`.
  - `GET /v1/admin/agencies/{id}/defaults` is extended to surface
    `outro_enabled: bool`, `outro_source: "uploaded" | "none"`,
    `outro_object_key: string | null` and
    `outro_duration_seconds: number | null` at the top level (mirror
    of how `intro_enabled` is already surfaced). The Intro & outro
    card hydrates the chip from these fields and never has to issue a
    second GET. `outro_enabled` is persisted through the existing
    `PUT /defaults` body (the front's `buildDefaultsBody` adds the key
    alongside `intro_enabled`).
  - Source selector in the UI offers three options: `Uploaded video`
    (primary, fires the upload), `Brand card` (disabled with tooltip
    "Coming soon" — not yet implemented on either side) and `None`
    (calls DELETE).
- **Agency intro upload** (feature 34) — symmetric to the outro contract
  above. The Defaults > Intro & outro card mounts both an `IntroCard` and
  an `OutroCard`; both are thin wrappers over the shared
  `UploadVideoCard` component that owns the multipart + validation logic:
  - `POST /v1/admin/agencies/{id}/intro/upload` — request:
    `multipart/form-data` with a single `file` part (MP4 or MOV,
    max 50 MB and 1–10 s enforced both client-side and server-side via
    ffprobe). Response 200: `{ intro_object_key: string,
    intro_duration_seconds: number, intro_source: "uploaded" }`.
    Documented server errors: 422 `INVALID_MIME`,
    413 `FILE_TOO_LARGE`, 422 `INVALID_DURATION`.
  - `GET /v1/admin/agencies/{id}/intro/file` — bytes of the persisted
    clip (`Content-Type: video/mp4` or the original mime). Same auth
    constraint as the outro endpoint — production callers must fetch
    via `defaultsApi.introDownload` (blob + `URL.createObjectURL`); the
    `<video src>` only works through the Playwright mock.
  - `DELETE /v1/admin/agencies/{id}/intro` — clears the persisted file
    and returns `{ intro_source: "none", intro_object_key: null }`.
  - `GET /v1/admin/agencies/{id}/defaults` is extended further to
    surface `intro_source: "uploaded" | "none"`,
    `intro_object_key: string | null` and
    `intro_duration_seconds: number | null` at the top level. The
    pre-existing `intro_enabled: bool` field stays as the toggle source
    of truth and is persisted through the existing `PUT /defaults` body
    (the front's `buildDefaultsBody` already emits it alongside
    `outro_enabled`).
  - Source selector in the UI is identical to the outro card:
    `Uploaded video` (primary), `Brand card` (disabled, "Coming soon")
    and `None` (calls DELETE). Copy: intro = "Plays at the start of
    every reel"; outro = "Plays at the end of every reel".
- **Render templates** — already implemented in
  `modules/configuration/transport/http/render_templates_router.py`:
  - `GET /v1/admin/agencies/{id}/render-templates` returns
    `{ agency_id, current_template_id, items: RenderTemplate[] }`.
    Each `RenderTemplate` is `{ template_id, display_name, description,
    status, sort_order, preview_images: [{kind, image_url, alt}],
    layout_variant, selected }`. `selected` is computed server-side from
    `current_template_id` so the front does not need to derive it.
  - `PUT /v1/admin/agencies/{id}/render-template` body
    `{ template_id }` (extra='forbid') →
    `{ status: 'saved', agency_id, render_template: RenderTemplate }`
    with `selected: true`. The Templates tab (`features/templates/`)
    consumes both endpoints; 404 on the PUT means the template_id is
    unknown to the backend catalog.
- **Per-reel photos override** (feature 35) —
  `PATCH /v1/admin/agencies/{id}/reels/{site_id}/{source_property_id}/photos`.
  - Body: `{ photos: [{position:int, selected:bool}, ...] | null }`
    (Pydantic `extra='forbid'` on the wrapper; pass `null` or `[]` to clear).
    The list is the FULL desired order — back persists `reel.photos_override`
    verbatim and re-enqueues the render.
  - Response 200: `{ photos_override, render_status: 'pending' }`. The
    editor's Photos tab flips a small `Re-rendering…` badge until a
    subsequent reel refetch reports `render_status: 'done'`.
  - 422 on invalid body shape; 404 when the reel tuple is unknown.
  - 409 `PHOTOS_OVERRIDE_LOCKED` when the reel's `workflow_state` is
    `approved` or `published` — the editor renders a persistent banner with
    the copy `"Cannot edit a reel that has already been approved"` and
    stops firing PATCHes. The client gates the same workflow states
    up-front so the banner appears even before the first edit.
  - The reel inspector GET surfaces `photos_override` so the editor's
    Photos panel seeds the per-tile `selected` flag from the override (or
    falls back to the legacy "first 8 selected" heuristic when null).
- **Per-reel subtitles override** (feature 36) —
  `PATCH /v1/admin/agencies/{id}/reels/{site_id}/{source_property_id}/subtitles`.
  Symmetric to the photos override above; same locked-banner and
  `Re-rendering…` badge primitives (`LockedReelBanner` + `RerenderBadge`
  in `src/features/reels/editor/lockedReelHelpers.jsx`).
  - Body: `{ cues: [{ index:int, text:str, in_seconds:float,
    out_seconds:float }, ...] | null }` (Pydantic `extra='forbid'`; pass
    `null` or `[]` to clear). The list is the FULL desired ordering — back
    persists `reel.subtitles_override` verbatim and re-enqueues the render.
  - Strict validation (front mirrors back, so the PATCH only fires when
    every rule holds):
    - `in_seconds >= 0`,
    - `out_seconds > in_seconds`,
    - no overlap: `cues[i].out_seconds <= cues[i+1].in_seconds`,
    - `1 <= len(text) <= 200`,
    - `index` values unique and strictly increasing.
  - Response 200: `{ subtitles_override, render_status: 'pending' }`. The
    editor's Subtitles tab flips the same `Re-rendering…` badge until a
    subsequent reel refetch reports `render_status: 'done'`.
  - 422 on invalid body shape (mirrors the rules above; never reached in
    normal use because the client validates first and shows inline errors);
    404 when the reel tuple is unknown.
  - 409 `SUBTITLES_OVERRIDE_LOCKED` when the reel's `workflow_state` is
    `approved` or `published` — same persistent banner copy as photos
    ("Cannot edit a reel that has already been approved"), no further
    PATCHes are fired. The client gates the same workflow states up-front
    so the banner appears even before the first edit.
  - The reel inspector GET surfaces `subtitles_override` so the editor's
    Subtitles panel seeds the cue rows from the persisted override; when
    null the panel falls back to `publish_target_snapshot.subtitles` (the
    worker's last serialization) and finally to the in-app seed (so the
    panel always has something to display).
  - Save mode: auto-save on a 1 s debounce — every edit (text, in, out,
    add, delete) collapses with any pending change into a single PATCH.
    There is no explicit "Save" button.
- **Per-reel slides override** (feature 37) —
  `PATCH /v1/admin/agencies/{id}/reels/{site_id}/{source_property_id}/slides`.
  Same locked-banner / `Re-rendering…` badge primitives as photos and
  subtitles (`LockedReelBanner` + `RerenderBadge` in
  `src/features/reels/editor/lockedReelHelpers.jsx`). Auto-save runs through
  the shared `useReelDebouncedOverride` hook (`debounceMs: 500`).
  - Body: `{ slides: [{ slide_id:str, position:int,
    duration_seconds:float, kind:str, ...kind-specific fields }, ...] | null }`
    (Pydantic `extra='forbid'` on the wrapper; pass `null` or `[]` to clear).
    The list is the FULL desired manifest — back persists
    `reel.manifest_override` verbatim and re-enqueues the render.
  - `kind` is a discriminated union:
    - `intro-video`, `outro-video`, `photo` — no extra fields.
    - `text` — requires `text:str`.
    - `google-review` — requires `url:str` and `status:str`; optional
      `rating:int`, `author:str`.
    - Unknown kinds → 422 with `loc: ['body','slides',i,'kind']`.
  - Hard ceiling: sum of `duration_seconds` must be ≤ 1.5x
    `target_duration_seconds` (per-reel budget). Above that → 422.
    The client surfaces a yellow warning when the sum exceeds the target
    and a stronger danger warning when it exceeds 1.5× — neither blocks
    the PATCH client-side; the back decides.
  - Response 200: `{ manifest_override, render_status: 'pending' }`. The
    editor's Slides tab flips the same `Re-rendering…` badge until a
    subsequent reel refetch reports `render_status: 'done'`.
  - 422 on invalid body shape (unknown kind, missing kind-specific fields,
    sum > 1.5x target); 404 when the reel tuple is unknown.
  - 409 `SLIDES_OVERRIDE_LOCKED` when the reel's `workflow_state` is
    `approved` or `published` — same persistent banner copy as photos /
    subtitles ("Cannot edit a reel that has already been approved"), no
    further PATCHes are fired. The client gates the same workflow states
    up-front so the banner appears even before the first edit.
  - The reel inspector GET surfaces `manifest_override` so the editor's
    Slides panel seeds rows from the persisted override; when null the
    panel falls back to the in-app `DEFAULT_SLIDES` seed (intro + outro).
    It also surfaces `target_duration_seconds` so the panel can compute
    the duration warning client-side without re-fetching defaults.
  - Save mode: auto-save on a 500 ms debounce — every edit (reorder,
    duration, toggle, kind-specific update) collapses with any pending
    change into a single PATCH. There is no explicit "Save" button.
- **Manual reel re-render** (feature 40) —
  `POST /v1/admin/agencies/{id}/reels/{site_id}/{source_property_id}/regenerate`
  triggers a fresh render run for an existing reel without changing any
  override. The Reel editor surfaces a "Regenerate" button that opens a
  confirm modal; the button is disabled (with tooltip
  "Re-rendering is disabled for published reels") when
  `publish_status === 'published'`.
  - Body: `{}` when the caller has no reason to attach, or
    `{ reason: string }` for audit-trail tagging. Pydantic
    `extra='forbid'` on the wrapper.
  - Response 200: `{ render_status: 'pending', job_id: string,
    queued_at: ISO8601 }`. The editor flips a `Re-rendering…` badge
    (same primitive as features 35/36/37) until a subsequent reel
    refetch reports `render_status: 'done'`.
  - 409 `REGENERATE_PUBLISHED_FORBIDDEN` — `publish_status` is
    `published`; the client gates this state up-front so the modal
    cannot reach the POST. The toast copy is "Re-rendering is disabled
    for published reels."
  - 409 `REGENERATE_ALREADY_IN_FLIGHT` — a render is already pending
    for the reel (`_rerendering` flag set server-side). The toast copy
    is "A render is already in progress for this reel."
  - 404 `ADMIN_REEL_NOT_FOUND` — reel tuple unknown.
- **Rendering** — input: photos + subtitles + music + brand + defaults; output: MP4 with burned-in subs, intro/outro, watermark, music, optional VO with ducking.
- **Publishing** — native APIs for IG, TikTok, YT, FB, LinkedIn, GMB. One short link per publish.
- **Approvals** — transactional emails with signed 1-click URLs.
- **Approve scheduling** — `POST /v1/admin/agencies/{id}/reels/{site_id}/{source_property_id}/approve`
  returns a `scheduled_at` (`string | null`, ISO8601 UTC). `null` /
  missing means the publish kicked off immediately; a string means the
  backend deferred the publish to a future slot (because the approve
  fired outside `agency_automation_rules.publish_window_*` /
  `publish_days`) and the Reel editor banner switches from
  `"Reel approved."` to `"Publicará el dd/mm/yyyy a las HH:MM."`
  (browser-local TZ). `idempotent_replay: true` still narrates the
  legacy "already approved" copy unless `scheduled_at` is also present,
  in which case the schedule banner wins.
- **Outgoing webhooks** (future) — `reel.published`, `reel.failed`, `reel.needs_approval`.

## Not yet wired
- Auth (login, password reset).
- Tenant-facing billing.
- Team panel inside tenant admin.
- Onboarding flow.

## Glossary

- **Reel** — vertical video from a listing.
- **Scene / slide** — unit inside the reel.
- **Tenant** — agency (4Reels customer).
- **Source** — listing origin (GHL or WP).
- **Hold window** — grace period after render before posting.
- **Ducking** — lowering music while VO speaks.
- **Karaoke highlight** — current word highlighted in subs.

See [ARCHITECTURE.md](ARCHITECTURE.md) for code structure.
