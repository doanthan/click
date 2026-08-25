import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const repo = readFileSync(path.join(root, "src/lib/event-repository.ts"), "utf8");
const eventPage = readFileSync(path.join(root, "src/app/events/[slug]/page.tsx"), "utf8");

test("the waitlist position a member is shown uses the promoter's own ordering", () => {
  // The promoter serves never-lapsed rows first. Counting the queue by
  // created_at alone told someone who missed their 30-minute window that they
  // were still #1 while every freed seat went past them.
  assert.match(
    repo,
    /order by \(waitlist\.last_offer_expired_at is not null\) asc, waitlist\.created_at asc/,
    "promoteNextWaitlister lost its ordering key",
  );
  const ordered = repo.match(
    /\(ahead\.last_offer_expired_at is not null, ahead\.created_at\)/g,
  );
  assert.equal(
    ordered?.length,
    2,
    "both the displayed position and the expiry notification must count by the promoter's key",
  );
  // Booleans sort false-before-true in Postgres, so `is not null` is what puts
  // never-lapsed rows ahead. `is null` would silently reverse the queue.
  assert.doesNotMatch(repo, /ahead\.last_offer_expired_at is null, ahead\.created_at/);
});

test("a cancellation refund is quoted against what is still held, not the original charge", () => {
  // issueRefund THROWS above the remaining balance rather than clamping, so
  // quoting the full amount after a per-seat guest refund cancelled the seat and
  // told the buyer their money was on the way while nothing had been sent.
  assert.match(repo, /txn_amount_cents - \(row\.txn_refunded_amount_cents \?\? 0\)/);
  assert.doesNotMatch(
    repo,
    /quoteCancellationRefund\(row\.txn_amount_cents, row\.starts_at\)/,
    "cancelRegistration is quoting the original charge again",
  );
});

test("a guest seat refunds what the buyer actually paid per seat", () => {
  // The fee is snapshotted into amount_cents at hold time; recomputing it from
  // the current booking_fee_bps pays against a rate the buyer may never have
  // been charged.
  assert.match(repo, /row\.txn_amount_cents \/ seatCount/);
  assert.match(repo, /Math\.min\(quote\.refundCents, remainingCents\)/);
});

test("the who's-going roster filters blocks, bans and the viewer themselves", () => {
  const preview = repo.slice(repo.indexOf("export async function getEventAttendeePreview"));
  const itemsQuery = preview.slice(0, preview.indexOf("count(*)::text as count"));
  assert.match(itemsQuery, /profile\.is_banned = false/);
  assert.match(itemsQuery, /profile\.suspended_at is null/);
  assert.match(itemsQuery, /blocker_profile_id = \$3::uuid/);
  assert.match(itemsQuery, /profile\.id <> \$3::uuid/);
});

test("claiming a paid guest seat checks who is claiming it", () => {
  const claim = repo.slice(
    repo.indexOf("export async function claimGuestSpotForProfile"),
    repo.indexOf("export type GuestTokenActionResult"),
  );
  assert.match(claim, /email-mismatch/);
  assert.match(claim, /lower\(gs\.guest_email\) = \$3::text/);
  // The purchaser must be told who actually took the seat, not the name of the
  // person it was bought for.
  assert.match(claim, /differentPerson/);
});

test("a seat-holder on a cancelled event is told, not 404'd", () => {
  assert.match(repo, /export async function getCancelledBookingNotice/);
  assert.match(eventPage, /getCancelledBookingNotice\(slug, session\)/);
});

test("upcoming and past split on when the event ends", () => {
  // Splitting on starts_at filed a 7-10pm booking under Past at 7:05pm while
  // the dashboard and the calendar chip both still called it upcoming.
  const confirmed = repo.slice(repo.indexOf("export async function getConfirmedEvents"));
  const scoped = confirmed.slice(0, confirmed.indexOf("export ", 10));
  assert.match(scoped, /coalesce\(event\.ends_at, event\.starts_at\) >= now\(\)/);
  assert.match(scoped, /coalesce\(event\.ends_at, event\.starts_at\) < now\(\)/);
});

test("an event with no pinned coordinates has no distance", () => {
  // Falling back to the CBD made it read as 0.0 km, win the Nearest sort and
  // pass a "within 2 km" filter while showing no distance on the card.
  assert.match(repo, /distanceKm: hasCoords \? distanceKmFromSydney\(lat, lng\) : null/);
  const explorer = readFileSync(path.join(root, "src/components/event-explorer.tsx"), "utf8");
  assert.match(explorer, /event\.distanceKm != null && event\.distanceKm <= distanceKm/);
  assert.match(explorer, /Number\.POSITIVE_INFINITY/);
});

test("lifecycle copy stays out of the banned verdict register", () => {
  // CLICK_LANGUAGE.md §5a bans "expire" / "wound down" framing by name.
  for (const file of [
    "src/components/clicks-list.tsx",
    "src/components/coordination-drawer.tsx",
    "src/app/people/page.tsx",
  ]) {
    const source = readFileSync(path.join(root, file), "utf8");
    const copy = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    assert.doesNotMatch(copy, /wound down/i, `${file} still says "wound down"`);
    assert.doesNotMatch(copy, /Clicks expire/i, `${file} still says "clicks expire"`);
  }
});

test("the published refund policy states the tiers the code actually pays", () => {
  const policy = readFileSync(path.join(root, "src/lib/refund-policy.ts"), "utf8");
  const page = readFileSync(path.join(root, "src/app/refund-policy/page.tsx"), "utf8");
  // The source of truth: >=48h full, 24-48h half, <24h none.
  assert.match(policy, /48/);
  assert.match(page, /48 hours or more/);
  assert.match(page, /50%/);
  assert.match(page, /Less than 24 hours/);
  // And it must not claim the booking fee is kept - quoteCancellationRefund is
  // fed amount_cents, which includes it.
  assert.doesNotMatch(page, /fee[^.]*is non-refundable on a standard/);
});

test("member profiles are not crawlable", () => {
  const robots = readFileSync(path.join(root, "src/app/robots.ts"), "utf8");
  // "/profile/edit" does not prefix-match /profile/<uuid>.
  assert.match(robots, /"\/profile"/);
});

// ---------------------------------------------------------------------------
// Second pass: the findings closed out after the first round.
// ---------------------------------------------------------------------------

const read = (p) => readFileSync(path.join(root, p), "utf8");

test("the Stripe application fee uses the configured rate, not the env default", () => {
  // createPaymentHold snapshots the fee with the merchant's commissionRateBps
  // from system_settings. The checkout fallback called calculateApplicationFee
  // with no rate, so it silently used PLATFORM_FEE_BPS - a different number the
  // moment an admin edits the commission, and this is what Stripe charges.
  const checkout = read("src/app/api/events/[eventId]/checkout/route.ts");
  assert.match(checkout, /const \{ commissionRateBps \} = await getSystemSettings\(\)/);
  assert.match(checkout, /calculateApplicationFee\(hold\.priceCents, commissionRateBps\)/);
  assert.doesNotMatch(
    checkout,
    /calculateApplicationFee\(hold\.priceCents\)/,
    "the fallback is back on the env rate",
  );
});

test("only the topmost modal answers Escape", () => {
  // Every shell listens on `document`. Stacked (booking dialog, then Stripe
  // checkout above it) one Escape ran both onClose handlers, and the dialog
  // underneath took every typed +1 row down with it.
  const shell = read("src/components/modal-shell.tsx");
  assert.match(shell, /const openShells: symbol\[\] = \[\]/);
  assert.match(shell, /openShells\.push\(shellId\)/);
  assert.match(shell, /if \(!isTopmost\(\)\) return;/);
  assert.match(shell, /openShells\.splice\(at, 1\)/, "the shell must pop itself on unmount");
});

test("unticking \"Name your +1s\" both unblocks payment and stops the details being sent", () => {
  // `rows` survives the untick, so reading it regardless blocked pay on a
  // consent checkbox that had just unmounted - AND still submitted the details.
  const pay = read("src/components/event-payment-button.tsx");
  assert.match(pay, /const namingActive = namingOn && tickets > 1;/);
  assert.match(pay, /const namedRows = namingActive \? rows\.filter/);
  // The submit GATE is the half that decides whether payment is reachable, and
  // it was left ungated while this test passed on namedRows alone: a row half
  // filled in before unticking still failed, and "Check the guest details
  // above." pointed at a block that had unmounted.
  assert.match(pay, /const rowErrors = namingActive \? rows\.map/);
});

test("a paid waitlist offer has one panel, one clock and no free confirm", () => {
  const button = read("src/components/event-registration-button.tsx");
  assert.match(button, /offerNeedsPayment/);
  // Paying IS confirming. A "Confirm your spot" button beside "Reserve & pay"
  // is both a second primary and an action that would seat them without paying.
  assert.match(button, /offerNeedsPayment \? \(\s*children/);
  assert.doesNotMatch(
    eventPage,
    /A seat opened up\. Reserve &amp; pay to claim it\./,
    "the page is rendering its own duplicate of the offer panel again",
  );
});

test("giving up a held waitlist seat asks first", () => {
  // A plain waitlist drop has nothing to lose and still goes straight through.
  // A LIVE offer does: the seat is held on a clock and rolls on with no undo.
  const button = read("src/components/event-registration-button.tsx");
  assert.match(button, /else if \(offerExpiresAt && !offerExpired\) \{\s*\/\//);
  assert.match(button, /confirmKind = isHold \? "hold" : offerExpiresAt && !offerExpired \? "offer"/);
});

test("safety actions never fail silently", () => {
  // These close their dialog and refresh on return, so a bare `return` looks
  // exactly like success - on the two controls someone reaches for when they
  // have stopped feeling safe.
  const actions = read("src/app/profile/[userId]/actions.ts");
  assert.match(actions, /async function requireSession\(\)/);
  assert.match(actions, /function requireTarget\(formData: FormData\)/);
  assert.doesNotMatch(actions, /if \(!session\?\.user\) return;/);
  assert.doesNotMatch(actions, /if \(!id\) return;/);
});

test("\"This weekend\" is one weekend", () => {
  // A flat `eventDays <= 7` also returned next Saturday when asked ON a
  // Saturday, so the label described two weekends every Fri/Sat/Sun.
  const explorer = read("src/components/event-explorer.tsx");
  assert.match(explorer, /const daysToSunday = todayDay === 0 \? 0 : 7 - todayDay;/);
  assert.match(explorer, /isWeekendDay && eventDays <= daysToSunday/);
  assert.doesNotMatch(explorer, /isWeekendDay && eventDays <= 7/);
});

test("day-vs-night buckets in Sydney time, like the card beside it", () => {
  const explorer = read("src/components/event-explorer.tsx");
  assert.match(explorer, /SYDNEY_HOUR/);
  assert.doesNotMatch(
    explorer,
    /new Date\(startsAt\)\.getHours\(\)/,
    "the filter is bucketing in the viewer's timezone again",
  );
});

test("every Discover filter survives a Back navigation", () => {
  // Only tag/category/q/date used to reach the URL, so free, time-of-day,
  // distance, suburb and sort were dropped on the most repeated action here.
  const explorer = read("src/components/event-explorer.tsx");
  for (const key of ['"time"', '"free"', '"suburb"', '"km"', '"sort"']) {
    assert.match(explorer, new RegExp(`next\\.set\\(${key}`), `${key} never reaches the URL`);
  }
  // And is adopted back when the URL changes from outside.
  assert.match(explorer, /setFreeOnly\(urlParams\?\.get\("free"\) === "1"\)/);
});

test("\"Clear all\" clears the search and the category too", () => {
  const explorer = read("src/components/event-explorer.tsx");
  // The button LABELLED "Clear all" - not the sibling "Clear filters" - used to
  // call resetFilters, leaving the search query and the category untouched.
  const at = explorer.indexOf("Clear all");
  assert.ok(at > 0, "the Clear all button is gone");
  assert.match(explorer.slice(at - 300, at), /onClick=\{resetAll\}/);
  assert.match(explorer, /key: "category", label: categoryFilter/);
});

test("a tag-less member still gets the add-interests on-ramp under matching v2", () => {
  // The v2 branch returned a hardcoded `fallback: false`, and v2 is default-ON,
  // so the one prompt that makes the feed personal never rendered.
  const v2 = repo.slice(repo.indexOf("if (settings.matchingV2Enabled)"));
  assert.match(v2.slice(0, 1400), /fallback,\n/);
  assert.doesNotMatch(v2.slice(0, 1400), /fallback: false/);
});

test("the catalogue query runs once per request", () => {
  // /discover awaits getEventsForExplore AND getPersonalizedDiscovery, which
  // calls it again internally.
  assert.match(repo, /export const getEventsForExplore = cache\(getEventsForExploreUncached\)/);
});

test("vibe tags render as labels, and old slug deep links still resolve", () => {
  assert.doesNotMatch(
    repo,
    /array_agg\(distinct tag\.slug\)\s*\n\s*filter \(where tag\.tag_type in \('interest', 'vibe', 'music'\)\)/,
    "an event tag aggregate is shipping kebab-case slugs again",
  );
  const explorer = read("src/components/event-explorer.tsx");
  assert.match(explorer, /function slugifyTag\(value: string\)/);
  assert.match(explorer, /event\.tags\.some\(\(tag\) => slugifyTag\(tag\) === normalizedTag\)/);
});

test("one refund window, quoted the same everywhere", () => {
  // The cancellation email was the lone outlier at "5 - 10 business days" - the
  // message someone reads exactly when they are anxious about their money.
  const cancelled = read("src/lib/email-templates/event-cancelled.ts");
  assert.match(cancelled, /3 to 5 business days/);
  assert.doesNotMatch(cancelled, /5 - 10 business days/);
});

test("member profiles carry a page-level noindex, not just a robots.txt Disallow", () => {
  // Disallow only asks a crawler not to FETCH; a linked page can still be
  // indexed URL-only. These pages carry a name, face, suburb and dating intent.
  const page = read("src/app/profile/[userId]/page.tsx");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
});

test("signing up on an address that already has an account gets a sign-in link", () => {
  const actions = read("src/app/login/actions.ts");
  assert.match(actions, /const hasAccount = await profileExistsByEmail\(input\.email\);/);
  assert.match(actions, /: hasAccount\n\s*\? "signin-link"/);
  // And the enumeration guard still holds: the lookup runs on BOTH paths and
  // nothing returns between it and issueMagicLink.
  const beforeIssue = actions.slice(0, actions.indexOf("issueMagicLink({"));
  assert.doesNotMatch(beforeIssue.slice(beforeIssue.lastIndexOf("profileExistsByEmail")), /return\s*\{/);
});

test("a name we invented from an email is never published as one they chose", () => {
  const helper = read("src/lib/display-name.ts");
  assert.match(helper, /export function isDerivedFromEmail/);
  // Onboarding must not prefill it - a prefilled field is a field nobody reads,
  // and this one lands on their profile and every event roster.
  const onboarding = read("src/app/onboarding/page.tsx");
  assert.match(onboarding, /isDerivedFromEmail\(session\.user\.name, session\.user\.email\)/);
  // And the one email that goes out BEFORE onboarding must not greet by it.
  assert.match(repo, /isDerivedFromEmail\(row\.display_name, row\.email\)/);
});

test("the streamed header reserves the space the real one will take", () => {
  // site-header--marketing is what the home hero's overlay keys on, and the
  // overlay makes the bar position:absolute. Hardcoding it meant a signed-in
  // visitor to "/" watched the page drop by the header height on hydration.
  const chrome = read("src/components/site-chrome.tsx");
  assert.match(chrome, /export function SiteHeaderShell\(\{ marketing = true \}/);
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /<SiteHeaderShell marketing=\{!headerSession\?\.user\} \/>/);
});

test("the marquee stops on its own and the support drawer traps focus", () => {
  const css = read("src/app/globals.css");
  // WCAG 2.2.2: :hover pause is a mouse-only escape hatch.
  assert.match(css, /animation: marquee-scroll 38s linear 4 both;/);
  assert.match(css, /\.marquee:focus-within \.marquee__track/);
  const widget = read("src/components/support/support-widget.tsx");
  // It claimed aria-modal while trapping nothing, on every route including checkout.
  assert.match(widget, /panelRef/);
  assert.match(widget, /if \(e\.key !== "Tab"\) return;/);
});

test("the daily set is actually daily", () => {
  const people = read("src/app/people/page.tsx");
  assert.match(people, /Australia\/Sydney/);
  assert.match(people, /clickable\[\(start \+ i\) % clickable\.length\]/);
  assert.doesNotMatch(people, /const dailySet = clickable\.slice\(0, 3\);/);
});

test("the bug widget is on the design system, not Tailwind's default palette", () => {
  // It ships to every visitor on every route, checkout included, so its colours
  // are production colours.
  const widget = read("src/components/support/support-widget.tsx");
  assert.doesNotMatch(
    widget,
    /(?:text|bg|border|ring|placeholder|accent)-(?:gray|slate|zinc|neutral|red|green|blue|amber|yellow|emerald)-\d{2,3}/,
    "a default-palette utility class is back in the widget",
  );
  // ACCENT is consumed only through style={{ }} on DOM nodes, so it takes the
  // token like everything else. It used to be an off-palette #7c6df2 sitting on
  // top of every page, checkout included - the one hardcoded hex in the product.
  // Asserted on the DECLARATION, not a whole-file grep: the comment above it
  // names the hex it replaced, and that comment is worth more than the grep.
  assert.match(widget, /const ACCENT = "var\(--purple\)";/);
  // ANNOTATION genuinely cannot be a custom property: <canvas> ctx.fillStyle /
  // ctx.strokeStyle resolve a colour, not a var(), and the SVG overlay builds
  // hex-alpha by concatenation (`${ANNOTATION}1a`). It tracks --danger by hand.
  assert.match(widget, /const ANNOTATION = "#B5362F";/, "ANNOTATION should track --danger");
  assert.doesNotMatch(widget, /#B03824/, "the old off-DS annotation red is back");
  // And the trigger is a button, so it takes the button radius - the pills in
  // this file are badges, which are allowed to be pills.
  const trigger = widget.slice(
    widget.indexOf('aria-label="Report a bug"'),
    widget.indexOf('aria-label="Report a bug"') + 400,
  );
  assert.match(trigger, /rounded-xl/, "the bug trigger lost the button radius");
  assert.doesNotMatch(trigger, /rounded-full/, "the bug trigger is back to a pill");
});

test("the category landing pages are reachable", () => {
  // generateStaticParams prerenders one page per category with its own title
  // and description - and nothing linked them, and the sitemap omitted them, so
  // the one set of pages built to be found could not be.
  const chrome = read("src/components/site-chrome.tsx");
  assert.match(chrome, /\["Categories", "\/categories"\]/);
  const sitemap = read("src/app/sitemap.ts");
  assert.match(sitemap, /\/categories\$\{""\}|\/categories`/);
  assert.match(sitemap, /categorySlug\(category\)/);
});

test("the legal pages describe suggestions, not matching", () => {
  // CLICK_LANGUAGE.md bans "match" by name: it is dating-app coded and collapses
  // the brand. "Suggest" is also strictly more specific about what is processed,
  // so the disclosure narrows nothing.
  for (const file of ["src/app/privacy/page.tsx", "src/app/terms/page.tsx"]) {
    assert.doesNotMatch(read(file), /matching|match you/i, `${file} still says "matching"`);
  }
});

test("a claimed guest +1 is a seat everywhere the app asks whether you have one", () => {
  // The claim writes only guest_spots.status='claimed' - the guest never gets an
  // event_attendees row, because the seat hangs off the purchaser's booking.
  // While the booking surfaces read event_attendees directly, a guest who
  // claimed a paid +1 was told "Your spot is confirmed" and then handed the
  // unregistered event page: venue locked, "Reserve & pay" on a seat their
  // friend had already paid for, and nothing in /dashboard or /confirmed-events.
  assert.match(repo, /const seatRowsSql = `\(/, "the shared guest-seat fragment is gone");
  const fragment = repo.slice(repo.indexOf("const seatRowsSql = `("));
  // Same liveness rule event_participants_v enforces: the guest seat counts only
  // while the purchaser's own booking is still confirmed.
  assert.match(fragment.slice(0, 900), /from guest_spots gs/);
  assert.match(fragment.slice(0, 900), /gs\.status = 'claimed'/);
  assert.match(fragment.slice(0, 900), /purchaser\.status = 'confirmed'/);

  // Every booking read must go through it. A count, not a boolean: adding a
  // fourth surface that reads event_attendees directly is how this regressed.
  const uses = repo.match(/from \$\{seatRowsSql\}/g) ?? [];
  assert.equal(
    uses.length,
    6,
    `viewerRsvpStatus + getProfileStatus + dashboard upcoming/waitlisted + confirmed-events upcoming/past = 6, found ${uses.length}`,
  );

  // Holding your own seat AND a claimed +1 for the same night is possible
  // (claimGuestSpotForProfile does not forbid it), so the viewer lookup has to
  // be deterministic about which row carries the status.
  assert.match(repo, /order by case when attendee\.seat_source = 'own' then 0 else 1 end/);
});

test("a plan nobody chose is attributed to nobody", () => {
  // The auto-suggestion used to be inserted with proposed_by = the person who
  // happened to click second, and coord_state advanced to 'proposed'. The drawer
  // then hid Confirm AND "Not this one" from them for an event they never picked
  // (coordination-drawer.tsx), while the other side was told they had picked it.
  const send = repo.slice(repo.indexOf("async function sendClickInner("));
  const insert = send.slice(0, send.indexOf("Mark both clicks of THIS process"));
  assert.match(insert, /insert into click_proposals/);
  assert.match(insert, /\$1::uuid, \$2::uuid, null, 'pending'/, "proposed_by must stay null");
  assert.doesNotMatch(
    insert,
    /coord_state = 'proposed'/,
    "a system suggestion leaves the mutual 'open' - nobody owes anybody an answer",
  );
  // ...and the surfaces have to be able to tell "nobody proposed" from "you did".
  assert.match(repo, /suggestedBySomeone: row\.proposed_by != null,/);
  const people = read("src/app/people/page.tsx");
  assert.match(people, /m\.suggestedBySomeone/);
});

test("every notification toggle we render is actually read by something", () => {
  // The whole class, not the three instances: /account-settings shipped switches
  // for a weekly digest and product news that no job sends, and a "Let hosts
  // message me" control governing a capability that does not exist. Each wrote
  // its key happily and nothing ever read it, so the setting looked respected.
  // A rendered toggle is a promise; this asserts the promise has a keeper.
  const settings = read("src/app/account-settings/page.tsx");
  const rendered = [...settings.matchAll(/settingKey="notify\.([A-Za-z]+)"/g)].map((m) => m[1]);
  assert.ok(rendered.length > 0, "no notification toggles found - did the markup change?");
  for (const key of rendered) {
    assert.ok(
      repo.includes(`notification_prefs->>'${key}'`),
      `/account-settings renders a "${key}" toggle that nothing in event-repository reads`,
    );
  }
});

test("the interests checklist counts interests", () => {
  // "Pick at least 3 interests" counted EVERY user_tags row, so finishing the
  // Life Quiz (which writes life/music/vibe tags) ticked it for someone with no
  // interests - while the matcher, which reads interest tags only, still had
  // nothing to work with.
  assert.match(repo, /where ut\.profile_id = \$1::uuid and t\.tag_type = 'interest'/);
});

test("a waitlist offer is never lost silently to a notification preference", () => {
  // The toggle gates the EMAIL. The in-app notification has to be unconditional:
  // a 30-minute offer nobody is told about is a seat quietly forfeited, which is
  // worse than the mail they asked us not to send.
  const promote = repo.slice(
    repo.indexOf("async function promoteNextWaitlister("),
    repo.indexOf("async function promoteNextWaitlister(") + 4000,
  );
  assert.match(promote, /notification_prefs->>'waitlistOffers'/);
  const notify = promote.slice(promote.indexOf("insert into notifications"));
  assert.doesNotMatch(
    notify.slice(0, 400),
    /wants_offer_email/,
    "the in-app notification must not be gated on the email preference",
  );
  assert.match(repo, /if \(!promotion\.wantsOfferEmail\) return;/);
});

test("browsing shares the front page's motion system, and reduced motion really is motionless", () => {
  const explorer = read("src/components/event-explorer.tsx");
  // The results grid is the whole point of /discover, and it used to paint N
  // cards in one frame and hard-cut on every filter change - the four actions
  // the surface exists for. The Reveal wrapper IS the filter transition:
  // surviving cards keep .is-in and stay put, new ones fade up as the observer
  // reaches them. Keyed on the event so that reconciliation works.
  assert.match(explorer, /<Reveal key=\{event\.id\} delay=\{\(index % 3\) \* 60\} className="min-w-0">/);
  // Per-row, never per-card: a flat index*n over a 60-result set parks the last
  // card behind seconds of delay.
  assert.doesNotMatch(explorer, /<Reveal[^>]*delay=\{index \* /);

  // ModalShell ships no entrance on purpose and expects the caller's card to
  // carry one. Four callers on the browse journey shipped without it, including
  // the money-committing dialog and a full-height bottom sheet.
  for (const file of [
    "src/components/event-detail-modal.tsx",
    "src/components/event-booking-dialog.tsx",
    "src/components/event-media-gallery.tsx",
    "src/components/event-explorer.tsx",
  ]) {
    assert.match(read(file), /cardClassName="[^"]*\brise-soft\b/, `${file} lost its modal entrance`);
  }

  const css = read("src/app/globals.css");
  // Collapsing animation-duration alone left the delay intact, and .rise-soft /
  // .pop-in are fill-mode `both`: the element held at the keyframe's 0%
  // (opacity 0) for the whole delay, then snapped in. The .rise-d* ladder goes
  // to 580ms, so reduced motion was buying a longer flash than no motion at all.
  const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduce, /animation-delay: 0\.01ms !important;/);
  assert.match(reduce, /transition-delay: 0\.01ms !important;/);
});

test("a banned account cannot take a seat by claiming a guest +1", () => {
  // assertBookingEligible is described in its own comment as "the single choke
  // point every booking path routes through" - but it only ever guarded three:
  // the free RSVP, the paid hold and the waitlist. The guest claim is the
  // fourth, and it puts someone in the same room for free, so a ban stopped
  // an account booking while a forwarded invite walked it straight past.
  const claim = repo.slice(
    repo.indexOf("export async function claimGuestSpotForProfile"),
    repo.indexOf("export type GuestTokenActionResult"),
  );
  assert.match(claim, /assertNotBannedFromSeats\(who\.rows\[0\]\)/);
  // Off the row the claim already reads - not a second round-trip.
  assert.match(claim, /p\.is_banned/);
  assert.match(claim, /p\.suspended_at/);
  // Before the mismatch branch, or a refusal becomes a way to probe whether a
  // given address was the one invited.
  assert.ok(
    claim.indexOf("assertNotBannedFromSeats(") < claim.indexOf("email-mismatch"),
    "the ban check must run before the email-mismatch response",
  );
});

test("the booking gate and the guest claim decide a ban the same way", () => {
  // One predicate, one message. Two copies of `is_banned || suspended_at` is
  // how the admin-email check drifted before it was centralised.
  assert.match(repo, /function assertNotBannedFromSeats\(/);
  const booking = repo.slice(repo.indexOf("async function assertBookingEligible"), repo.indexOf("async function assertBookingEligible") + 1400);
  assert.match(booking, /assertNotBannedFromSeats\(row\)/);
  assert.doesNotMatch(
    booking,
    /if \(row\?\.is_banned \|\| row\?\.suspended_at\)/,
    "assertBookingEligible is deciding the ban itself again",
  );
  const route = readFileSync(path.join(root, "src/app/api/claim/[token]/route.ts"), "utf8");
  // A ban is a 403 with the reason, like the RSVP and checkout routes - not the
  // 500 an unmapped error name used to produce.
  assert.match(route, /name === "ForbiddenError" \? 403/);
});

test("money on the merchant and admin surfaces is never rounded to whole dollars", () => {
  // maximumFractionDigits: 0 rounds, and it rounds UP - a $12.50 payout told the
  // host "$13". Every money surface routes through @/lib/amounts, which shows
  // cents only when there are cents.
  for (const rel of [
    "src/components/merchant-portal-shared.tsx",
    "src/app/admin/merchants/[merchantId]/page.tsx",
    "src/components/merchant-finances-tab.tsx",
    "src/components/merchant-dashboard-tab.tsx",
  ]) {
    const src = readFileSync(path.join(root, rel), "utf8");
    assert.doesNotMatch(src, /maximumFractionDigits: 0/, `${rel} is rounding money again`);
  }
  const shared = readFileSync(path.join(root, "src/components/merchant-portal-shared.tsx"), "utf8");
  // The old rounding helpers are gone, not merely unused - an exported one is a
  // re-import away from coming back.
  assert.doesNotMatch(shared, /export function formatMoney|export function formatPrice|priceFormatter/);
});

test("the post-event window is named where the prompt is offered", () => {
  // The banner above the prompt used to say "No rush" for a surface that hard-
  // closes at event end + 48h. The window is named on the CARD - the component
  // that offers the taps - so it travels to BOTH surfaces that render the
  // prompt, including /events/[slug], which has no banner above it at all.
  const dashboard = readFileSync(path.join(root, "src/app/dashboard/page.tsx"), "utf8");
  const detail = readFileSync(path.join(root, "src/app/events/[slug]/page.tsx"), "utf8");
  const card = readFileSync(path.join(root, "src/components/post-event-click-card.tsx"), "utf8");
  assert.doesNotMatch(dashboard, /No rush/);
  assert.match(card, /POST_EVENT_CLICK_WINDOW_HOURS/);
  // Naming it on the card only counts if the card is what these pages render.
  assert.match(dashboard, /<PostEventClickCard/);
  assert.match(detail, /<PostEventClickCard/);
  // One deadline, one place. The banner restating the card's line verbatim is
  // how this surface grew three headings saying the same thing before.
  assert.doesNotMatch(dashboard, /hours after the event/);
});

test("no unwired proposal clock sits beside the one that ships", () => {
  // PROPOSAL_RESPONSE_WINDOW_HOURS = 48 had zero references while both proposal
  // writers stamp MUTUAL_CLOCK_DAYS (7 days). Wiring it up would have silently
  // cut every live proposal to 48 hours.
  const constants = readFileSync(path.join(root, "src/lib/clicks/constants.ts"), "utf8");
  assert.doesNotMatch(constants, /export const PROPOSAL_RESPONSE_WINDOW_HOURS/);
  assert.doesNotMatch(repo, /PROPOSAL_RESPONSE_WINDOW_HOURS/);
  assert.match(repo, /interval '\$\{MUTUAL_CLOCK_DAYS\} days'/);
});

test("accepting a waitlist promotion is behind the same gate as joining one", () => {
  // JOINING a waitlist routes through registerForEvent and was gated there.
  // ACCEPTING the promotion routed through nothing - so someone banned after
  // they joined, then promoted by expireWaitlistOffers or cancelRegistration,
  // could POST at the accept route and sit in the room with whoever reported
  // them. Free events only: paid offers bounce to createPaymentHold, gated.
  const start = repo.indexOf("export async function acceptWaitlistOffer");
  assert.ok(start > -1, "acceptWaitlistOffer not found");
  const accept = repo.slice(start, start + 1600);
  assert.match(accept, /await assertBookingEligible\(pool, profile\.id\)/);
  // Before the transaction opens, so a refusal never holds a pool connection.
  // Matched on the full statement, not the bare "pool.connect()" - the comment
  // above the gate names that call, and a substring check finds the prose first.
  assert.ok(
    accept.indexOf("await assertBookingEligible")
      < accept.indexOf("const client = await pool.connect()"),
    "the gate must run before the transaction opens",
  );
  const route = readFileSync(
    path.join(root, "src/app/api/events/[eventId]/waitlist/accept/route.ts"),
    "utf8",
  );
  // Without this branch the refusal fell through to the catch-all 500.
  assert.match(route, /error\.name === "ForbiddenError"/);
});

test("every route that can put someone in a room goes through a ban gate", () => {
  // The completeness guard. If you add a sixth way to hold a seat, this fails
  // and you decide deliberately which of the two gates it belongs behind -
  // assertBookingEligible (ban + onboarding) or assertNotBannedFromSeats (ban
  // only, for the guest claim, whose invited friend onboards afterwards).
  const gated = repo.match(/await assertBookingEligible\(pool, profile\.id\)/g) ?? [];
  assert.equal(
    gated.length,
    3,
    "expected registerForEvent, createPaymentHold and acceptWaitlistOffer - a change here means a seat route was added or lost its gate",
  );
  assert.match(repo, /assertNotBannedFromSeats\(who\.rows\[0\]\)/);
});

test("the merchant monthly report does not round a host's revenue", () => {
  // The one money document a host forwards to a bookkeeper. A local formatAud
  // shadowed the module-level one with maximumFractionDigits: 0, so a
  // $1,234.50 month arrived as "$1,235".
  const start = repo.indexOf("sendMerchantMonthlyReports");
  assert.ok(start > -1, "sendMerchantMonthlyReports not found");
  const fn = repo.slice(start, start + 4000);
  assert.doesNotMatch(fn, /maximumFractionDigits: 0/);
  assert.doesNotMatch(fn, /const formatAud =/, "the rounding shadow is back");
});
