# Click QA run - 22 September 2026

Result: the two-person driver's happy path passed using real repository actions and database writes. Both customer-facing Clicks lists and final plan drawers were also checked. This is not a complete two-browser acceptance test of every customer-facing input.

Environment: local development, http://127.0.0.1:3001, connected to the production database. Approved QA pair: Maya Chen (maya@click.local) and Ruby Alvarez (ruby@click.local). Event: qa-click-plan-a, a free QA fixture.

## Observed results

| Check | Result | Evidence |
| --- | --- | --- |
| Reset pair | Pass | Reset reported the pair was already fresh; zero clicks or mutuals. |
| Maya sends discovery click | Pass | One pending click. Ruby's own view showed no incoming click, mutual or plan. |
| Ruby reciprocates | Pass | Two mutual click rows, one active mutual, one notification for each person in the activity log. |
| Independent reveal | Pass | Marking Maya seen changed only her reveal stamp. Ruby remained unseen. |
| Choose Plan A | Pass | Mutual changed from open to proposed; one pending plan. No automatic plan was created in this run, so explicit suggestion was exercised. |
| Ruby confirms | Pass | Plan accepted; neither person had a seat; mutual not yet confirmed_together. |
| Maya takes a seat | Pass | Maya's own seat and Ruby's partner seat showed taken. Ruby still had no seat. |
| Ruby takes a seat | Pass | Both views showed both seats; mutual became confirmed_together. |
| Reload | Pass | Accepted plan and confirmed_together state persisted. |
| Repeat discovery send | Pass | Activity log recorded a no-op with no row changes. |
| Self-click | Pass | Refused with “You cannot Click yourself.” |
| Maya's real /proposals page | Pass | “Both going” row and the “You're both going” drawer for Ruby and Plan A. |
| Ruby's real /proposals page | Pass | “Both going” row. Her unseen reveal appeared first; after “Maybe later”, reopening showed the “You're both going” drawer. |
| Database cross-check | Pass | One active mutual, two mutual click rows, two confirmed registrations on qa-click-plan-a. |
| Driver browser errors | Pass | No error-level console entries observed during the happy path. |

## Scope and remaining acceptance

The writes were driven through /test-click. The final customer screens were inspected sequentially, not in two isolated browser sessions. The shared browser session changed during inspection; account identities were verified from the page banners before recording each customer view. Account switching itself is not signed off by this run.

Not exercised in this run: customer-facing send/confirm/RSVP inputs from beginning to end, automatic event selection, post-event windows, alternative/decline paths, capacity recovery, cancellation, block/suppression, expiry jobs, paid checkout, email delivery, or deployed/mobile behavior. See test-click-uat.md for the human tester checklist.

Left in place: Maya and Ruby have one active mutual and two confirmed free seats on Plan A. No fixture rebuild or global lifecycle sweep was run. No paid booking was made. Another complete run needs a coordinated reset of the pair and its QA bookings; resetting the pair alone does not clear seats.
