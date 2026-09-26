# Changelog

## [0.3.0.0] - 2026-09-26

### Added

- Approve sends once through the ledger outbox, then watches the thread. A reply parks the next draft on the same run. Kill leaves a sent message sent.
- Sign in with Google can store more than one Gmail account. The token exchange sends the PKCE verifier. Live channel lists show the vault, not the example pack.
- A workflow desk can scan recent mail, draft a parked reply, and call a webhook. Connecting still never sends.
- The rail train is specified as T41–T54. Each ticket is its own pull request. Huffman, Carmen, Drive, a second client space, and an evals-admin screen stay held.

### Changed

- Postgres for local Compose is published on `127.0.0.1:5435`.
- Unknown pack ids return `pack.unknown` (400). `pack-unseen-engine` loads. The dial can park, hold, or deny, and it cannot send.

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
