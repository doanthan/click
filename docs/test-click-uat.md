# Click user acceptance test

Status: the driver happy path and both final customer views passed on 22 September 2026; see [run results](test-click-results-2026-09-22.md). Full two-session user acceptance remains to be completed.

## Prepare the session

The test owner opens `/test-click` in the intended environment. Local development is currently at http://127.0.0.1:3001/test-click. A remote tester needs the deployed site; localhost only works on the developer's computer. These edits must be deployed before a remote tester sees them.

On a deployment, an authorised QA unlock is required. Arrange access with the test owner; do not send secrets in a bug report. This harness can act as QA accounts and is intended for trusted testers.

1. Check the fixture readiness message. Rebuild if the dates are out of their test windows. Rebuilding reschedules seven QA events and clears their existing registrations and waitlists, so coordinate with anyone already testing.
2. Select Maya and Ruby, or two other eligible QA people. Avoid personas listed under “Cannot take part”.
3. Have the owner reset the pair if an existing click, mutual, block or suppression would interfere with the run. Reset deletes test history. Production resets need the owner's approval.
4. The just-ended scenario ages out after roughly 90 minutes from a fresh rebuild. Re-check readiness before post-event tests.
5. Use two separate browser profiles or devices for the real user journey. Sign each into one of the selected QA personas. Two tabs in the same profile share a login.

## Happy path

Use the real People/Clicks/event pages first. The driver is a diagnostic view for the test owner, not a replacement for testing those screens.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | A sends a discovery click to B | A sees it as sent. B sees no incoming click or notification. |
| 2 | B sends a discovery click to A | One mutual appears for both people. |
| 3 | A dismisses the mutual reveal; refresh both sessions | A's reveal stays dismissed; B's reveal is independent. |
| 4 | Use the suggested plan, or suggest one if absent | Both people see the same plan. |
| 5 | Suggest an alternative | The shared plan changes without ending the mutual. |
| 6 | Either person confirms | The plan is accepted; this has not booked seats. |
| 7 | A RSVPs to the agreed free QA event | A holds a seat; the pair is not yet both going. |
| 8 | B RSVPs to the same event | Both hold seats; both see the going-together state. |
| 9 | Refresh both sessions | The state persists. |

## Separate runs

Have the test owner prepare a clean pair between scenarios that end or suppress the connection.

- Self-click: refused, no click row created (driver test).
- Repeat send: succeeds quietly without a duplicate click or mutual.
- Open post-event window: accepts; closed window: refuses. The prompt delay is 2 hours, while sends are allowed from event end until 48 hours later.
- Mixed surfaces: one discovery send and one post-event send do not form a mutual.
- Decline: the plan ends, but the mutual can coordinate another plan.
- Full event: use the free capacity fixture; the pair gets a recovery path, not a seat it did not book.
- Cancel one RSVP after both booked: the remaining person sees the recovery.
- Block: live coordination ends and further interaction is refused.

Leave global lifecycle sweeps, fixture cancellation, and clock manipulation to the test owner. The sweep operates on all users in the connected database. Paid checkout requires a separate payment test plan.

## Record results

For each step record: environment, time, pair, pass/fail/not tested, expected result, actual result, and screenshot if useful. Use the site's “Report a bug” control for failures. The in-memory activity log is diagnostic only and disappears on restart; the scenario board is current state, not a historical pass report.

Sign off only after the real two-session happy path and the agreed edge cases have been observed. Automated tests passing alone is not acceptance.
