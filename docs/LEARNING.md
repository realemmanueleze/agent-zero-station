# Learning

A daily job (03:00 local when you wire cron) reads `outcomes` and writes:

`packs/<packId>/proposals/YYYY-MM-DD.md`

You copy or `git apply` that file into `directives.md`. The job never merges. There are no embeddings.

Empty days still write a file so the miss is visible.
