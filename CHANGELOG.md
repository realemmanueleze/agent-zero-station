# Changelog

## [0.2.0.0] - 2026-09-16

### Added

- Add source can open Nango Connect for Gmail and Slack. Users sign in with Google or Slack; the station stores a Nango connection id, not the OAuth secret.
- Nango webhooks complete a live mailbox when HMAC (`X-Nango-Hmac-Sha256`) matches the webhook signing key. Failed Connect attempts stay quiet (`{ ok: true }`).
- The desk parks Nango Gmail and Slack inbound and sends only after Approve. Failed send stays parked. Gmail replies go to the sender. Duplicate Gmail ids are not re-parked.
- Off-box desk access needs `STATION_COCKPIT_PASSWORD` (login cookie). Localhost stays open. Nango's webhook stays HMAC-only.
- Compose smoke: fixture park on `127.0.0.1:29173` with `postgres:16-alpine`.

### Changed

- Command deck screens (park, channels, accounts, packs, activity, brief) share one station shell, empty/error states, and OS light/dark plus high-contrast.
- Docker cockpit listens on all interfaces inside the container so published ports work; host maps stay loopback (`127.0.0.1:19173`).

### Fixed

- Recipients with CR/LF are rejected before send. `NANGO_SECRET_KEY` is redacted in logs.
- A deleted mailbox is not revived by a replayed webhook. Sync/forward Nango payloads are ignored. `Host: localhost` from a public hop no longer skips the desk password.

## [0.1.0.0] - 2026-09-04

### Added

- Add source on every channel kind: Sign in with Google or Slack, or paste fields. Secrets sit in a ledger `connections` table as AES-256-GCM envelopes.
- Command deck: Action, Channels, Activity, and Brief. More than one mailbox can wait on Approve.
- Email producer parks inbound with the mailbox `account` and `to`. Connecting never sends.

### Changed

- Live mailbox setup is Add source, not IMAP keys in `.env`. Google callback is `/oauth/google/callback`. Testing-mode tokens die in 7 days.

### Fixed

- Approve uses the decision's mailbox, not `email[0]`. A deleted or `needs_reauth` box stays parked.
