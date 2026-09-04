# Privacy

Agent Zero Station is a kit you clone and host. There is no hosted SaaS and no shared OAuth client.

## What this install holds

- Mailbox tokens and pasted secrets sit in your ledger, encrypted with `STATION_MASTER_KEY` that you set.
- Parked drafts stay on your worker. Approve is the only send.
- Logs redact OAuth tokens, the master key, control tokens, and raw mail bodies.

## What this repo does not do

- It does not operate your mailbox.
- It does not send analytics to the authors.
- It does not share your Google or Slack app with other forkers.

## Contact

The operator of a given install is whoever hosts that container. For this public kit, file an issue on the GitHub repo.

Google OAuth verification for a forker's own client can point at `https://<their-host>/privacy`.
