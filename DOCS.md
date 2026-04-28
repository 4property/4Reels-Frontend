# 4Reels — Product docs

Multi-tenant SaaS that generates vertical reels (3:4 / 9:16) from real-estate listings, publishes them to social networks, and tracks the traffic they drive. Integrates with **GoHighLevel** and **WordPress** as listing sources.

The current frontend simulates the full product. Data is mocked in `src/lib/api/mock/store.js`; every screen reflects the contract the backend must fulfill.

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
- **Library**: tracks with waveform, BPM, mood tags, property types. Favorites are the AI selection pool. MP3 upload.
- **Selection rules**: which tracks the AI may pick by property type and listing status. Fallback to favorites if no rule matches.

### Social — `features/social/`
Per-network description templates with `{{variables}}` and live preview. Shows connected networks with handles and char limits.

### Brand — `features/brand/`
Identity (logo, colors, heading font), watermark (position + opacity), outro card. Live 3:4 preview reacts to changes.

### Defaults — `features/defaults/`
Render defaults applied to every new reel (overridable per reel). Six sub-tabs: Format & locale, Subtitles style, Video & timing, Intro & outro, Audio, Caption generation.

### Automation — `features/automation/`
Two mutually-exclusive modes:
- **Publish automatically** — hold window, quiet hours, skip weekends, default networks.
- **Review by email** — email to a recipient list with 1-click Approve / Edit / Reject.

Shared: auto-generate subtitles, re-render on upstream data changes.

### Admin — `features/admin/`
Super-admin view. Platform metrics + agencies table. Click a row → drawer with three tabs:
- **Sources** — GHL (Location ID + token, test connection) and WordPress (URL + Application Password, polling interval).
- **Billing** — plan, MRR, seats, next invoice. Open in Stripe.
- **Activity** — event log.

Invite-agency modal from header.

**Team & permissions** (`admin/team/`) — security policy (2FA, SSO, session timeout), members table, role permissions matrix (Admin / Editor / Viewer × modules). Implemented but not yet wired into navigation.

### Notifications — `features/notifications/`
Modal from the topbar bell. Channels (Email / Slack / SMS), per-recipient event subscriptions (needs approval, published, failed render), delivery frequency (instant / hourly / daily digest).

## Data model (mock)

Defined in `src/lib/api/mock/store.js`.

| Entity | Key fields |
|---|---|
| `agency` | name, tenantId, plan, logo, color |
| `socials[]` | id, name, connected, handle |
| `reels[]` | id, title, address, price, status, publishStatus, scenes, music, kind, type, networks[], tracker |
| `tracks[]` | id, title, artist, bpm, mood[], propertyTypes[], statuses[], favorite, waveform[] |
| `variables[]` | `{{tag}}` catalog |
| `tenants[]` | agencies (super-admin) |
| `team[]` | members with role, 2FA, SSO |
| `roles[]` | Admin / Editor / Viewer with permission matrix |

## Backend contract

What the real backend must implement:

- **Ingestion** — GHL via Private Integration Token + Location ID; WordPress REST + Application Password.
- **Rendering** — input: photos + subtitles + music + brand + defaults; output: MP4 with burned-in subs, intro/outro, watermark, music, optional VO with ducking.
- **Publishing** — native APIs for IG, TikTok, YT, FB, LinkedIn, GMB. One short link per publish.
- **Approvals** — transactional emails with signed 1-click URLs.
- **Outgoing webhooks** (future) — `reel.published`, `reel.failed`, `reel.needs_approval`.

## Not yet wired
- Real backend — everything mocked.
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
