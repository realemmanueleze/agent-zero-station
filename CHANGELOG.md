# Changelog

## [0.1.0.0] - 2026-09-04

### Added

- Add source on every channel kind: Sign in with Google or Slack, or paste fields. Secrets sit in a ledger `connections` table as AES-256-GCM envelopes.
- Command deck: Action, Channels, Activity, and Brief. More than one mailbox can wait on Approve.
- Email producer parks inbound with the mailbox `account` and `to`. Connecting never sends.

### Changed

- Live mailbox setup is Add source, not IMAP keys in `.env`. Google callback is `/oauth/google/callback`. Testing-mode tokens die in 7 days.

### Fixed

- Approve uses the decision's mailbox, not `email[0]`. A deleted or `needs_reauth` box stays parked.
