# Hardening review - findings for the in-flight changeset

Date: 30 July 2026. Produced by an adversarial review of the production-hardening
work. Line numbers are as of the working tree on this date - the files are in
flux, so re-grep before applying.

## 1. Resolved: `logEmailEvent` + legacy sender double-send audit

The co-fire sites were audited. Merchant approval/rejection now use only the
templated `logEmailEvent` delivery path; the legacy sender is limited to merchant
states without a template. The nearby guest-cancellation and waitlist-promotion
calls target different recipients and are not duplicates.

### Resolution

- **`updateMerchantVerificationForAdmin`** sends `approved` and `rejected`
  through `logEmailEvent` only. `pending` and `suspended` retain the legacy text
  sender because no HTML template exists for those states.

### Other adjacent call sites

The guest cancellation template emails the guest; the adjacent waitlist message
emails the newly promoted waitlister. Remaining legacy calls are standalone.

## 2. Already handled (verified - no action needed)

- **`forgot-password/actions.ts`** - rewritten to the single-use magic-link flow;
  no legacy `sendTransactionalEmail` co-fire. Good.
- **`/business`, `/scale`, `/test-click`** - now present in
  `INTERNAL_ROUTE_PREFIXES` (`src/lib/runtime-mode.ts`), so `src/proxy.ts` 404s
  them in production. The earlier exposure gap is closed.

## 3. Minor (only if a dispute-audit dedup was added)

If `recordDisputeAudit` (`src/lib/stripe-sync.ts`) dedups on `dispute_id +
status`, two genuinely distinct `charge.dispute.updated` events that share a
status get dropped. Prefer deduping on the Stripe `event.id` (thread it in) so
only true webhook retries collapse. Audit-only rows, so low priority.

## Provenance

These are the only findings that survived adversarial verification against the
current working-tree code. A parallel `feat/prod-hardening` branch was explored
against an older base (`caff3f8`) and then abandoned - the in-flight changeset is
a more complete, tested superset of it. The full go-live audit lives in
`context/GO_LIVE_CHECKLIST.md`.
