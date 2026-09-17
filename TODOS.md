# TODOS

## Station

### Google OAuth app verification (restricted Gmail scopes)

**What:** Submit the station's Google OAuth client for verification of `gmail.readonly` + `gmail.send` when leaving Testing mode.

**Why:** Testing-mode refresh tokens die in 7 days. Past a handful of test users, Google blocks the app until review.

**Context:** T15 Sign in works in Testing with the founder added as a test user. FIRST_RUN must state the 7-day limit. Verification needs a privacy policy URL and a demo video. This is a vendor process, not more station code. Start from the Google Cloud OAuth client created in the T15 assignment.

**Effort:** L
**Priority:** P2
**Depends on:** T15 Add source landed; `/privacy` ships in the kit. Point Google at `https://<your-host>/privacy`.

### Arm pollers when Nango connect completes

**What:** Start `email:` / `slack:` producers when webhook, import, or complete marks a row live, instead of only at worker boot.

**Why:** A mailbox connected after boot stays live with no inbound park until restart. Approve has nothing to do.

**Context:** Adversarial review on T28–T31. `startLiveProducers` runs once in `apps/worker`. `pollProducer` also swallows tick errors. Pair with a visible error status if poll 502s.

**Effort:** M
**Priority:** P2
**Depends on:** T30 Nango runtime landed.

### OpenAPI for the command API

**What:** Publish an OpenAPI document (and optional SDK) for `GET /park` and `POST /park/:id/{approve,edit,kill}`.

**Why:** DX review wanted machine-readable errors; curls and FIRST_RUN fragments are the v1 vehicle.

**Context:** Autoplan DX POLISH deferred this. Track A2 curls are the copy-paste client. Add when a second language client exists.

**Effort:** M
**Priority:** P3
**Depends on:** T32 wire contract landed.

### `station approve` CLI wrapper

**What:** A one-liner CLI around the T32 Approve curl.

**Why:** Slightly nicer than copy-paste; not required for TTHW.

**Context:** DX dual voices preferred curls first. Do not block T32.

**Effort:** S
**Priority:** P3
**Depends on:** T32 FIRST_RUN Track A2.

### Park-slip mockups (OpenAI image key)

**What:** Generate DESIGN_READY park-slip / phone HITL mockups once an OpenAI key is in the environment.

**Why:** Design review had text contract only (`DESIGN_READY` then `VARIANTS_EXIT:1`).

**Context:** `$D` binary present; key missing. Implementer can ship from the frozen field order without pixels.

**Effort:** S
**Priority:** P3
**Depends on:** None.

## Completed
