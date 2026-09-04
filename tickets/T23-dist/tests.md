# T23 tests (commit before the files)

1. `fly.toml` exists and names ports 19173 / 19174 or the env overrides.
2. `.github/workflows/release.yml` publishes to GHCR on tag.
3. DEPLOY.md mentions Fly and GHCR.
4. Scoring turn still cannot call `commit_send`.
