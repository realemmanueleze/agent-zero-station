# T11 tests (commit before the email channel)

1. `commitSend` with a failing transport throws `send.provider_failed` and the decision stays `parked`.
2. A successful transport returns a provider id and the decision becomes `sent`.
3. Two mailbox ids produce isolated prompt buffers: tenant A never contains tenant B's address.
4. Adding a second email row in `station.config.ts` does not require a code change to the channel.
5. Logs from a failed send do not contain the mail body or SMTP password.
