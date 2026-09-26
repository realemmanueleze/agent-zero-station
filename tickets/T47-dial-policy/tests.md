# T47 tests

After T46. The policy decides whether a run parks. It does not send. Replace `tests/tickets/T47-dial-policy.test.ts` skip with this red suite before program code. Absorbs the dial half of T33.

1. `ask_me` parks at `human_review`.
2. `just_do` holds, then re-checks. The hold does not call the provider.
3. `never` throws `policy.denied` (403). Nothing is sent.
4. A tool and `learning.ts` cannot change the dial.
5. A hold survives restart fail-closed. Kill during a hold cancels it.
