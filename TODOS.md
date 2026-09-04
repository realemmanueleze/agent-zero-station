# TODOS

## Station

### Google OAuth app verification (restricted Gmail scopes)

**What:** Submit the station's Google OAuth client for verification of `gmail.readonly` + `gmail.send` when leaving Testing mode.

**Why:** Testing-mode refresh tokens die in 7 days. Past a handful of test users, Google blocks the app until review.

**Context:** T15 Sign in works in Testing with the founder added as a test user. FIRST_RUN must state the 7-day limit. Verification needs a privacy policy URL and a demo video. This is a vendor process, not more station code. Start from the Google Cloud OAuth client created in the T15 assignment.

**Effort:** L
**Priority:** P2
**Depends on:** T15 Add source landed; a public privacy policy URL

## Completed
