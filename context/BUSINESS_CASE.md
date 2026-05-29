# Click — Business Plan

> **Click is an event-first social connection platform.** Users discover curated events matched to their personality and interests. They attend. They optionally signal interest in other attendees — anonymously. Mutual interest unlocks a shared follow-up event suggestion. Never a chat window.

---

## 1. What We Are Building

### The Product in One Paragraph

Click is an event-first social connection platform. Users discover curated events matched to their personality and interests. They attend. They optionally signal interest in other attendees — anonymously. Mutual interest unlocks a shared follow-up event suggestion. Never a chat window.

We are **not** a dating app. **Not** a ticketing platform. **Not** a messaging product. We are a new category: **structured in-person connection through shared experience.** The event is the icebreaker. We handle everything else.

### 1.1 The Problem We Solve

Sydney is the third worst city in the world for making friends. 73% of Sydneysiders say it is hard or impossible. 43% of Australians under 25 feel chronically lonely. The NSW Parliament opened a formal loneliness inquiry in 2024. This is a documented, quantified, growing problem — and no platform at scale exists to solve it in Australia.

Every existing solution fails in the same way: they ask users to do the hardest part themselves. Meetup gets you to a room. Bumble BFF asks you to chat with a stranger. Tinder asks you to swipe. None of them remove the fundamental awkwardness of approaching someone you do not know.

Click removes that moment entirely. The event is the approach. Two people at a pottery class do not need a reason to talk — they already have one. We create the conditions. They do the rest.

### 1.2 How the Product Works — The Core Loop

| Step | What the user does | What happens in the background |
| --- | --- | --- |
| **1. Sign up** | Selects intent (friendship / dating / networking), picks interest tags, optionally takes the life quiz | Profile built; tag graph created; matching engine initialised |
| **2. Discover** | Browses a curated event feed personalised to their interests, location, and vibe | Algorithm ranks events by tag overlap, proximity, availability, persona match |
| **3. RSVP** | Books an event — free or paid via Stripe; venue address unlocked on confirmation | Capacity updated; attendee list grows; FOMO signals generated for other users |
| **4. Attend** | Goes to the event; shared activity provides natural conversation structure | Post-event prompt queued for 12 hours after event end time |
| **5. Click** | 12 hours after the event, user can anonymously signal interest in attendees they connected with | Click stored privately; checked against other attendees' clicks |
| **6. Mutual click** | Both users clicked each other — a shared follow-up event is suggested to both, not a chat window | Match logged; event suggestion surfaced; both notified |
| **7. Repeat** | Returns for more events; suggestions improve with every interaction | Matching engine learns; profile deepens; social graph grows |

### 1.3 Why No Chat

This is a deliberate design decision, not a missing feature. Sydney has a documented aversion to cold social approaches. Chat-first platforms fail here because they recreate exactly the dynamic users are trying to avoid: a stranger in your inbox asking you to talk.

No chat also eliminates the primary harassment and safety vector in social apps. It makes Click significantly safer for women and marginalised users than any chat-first alternative. It is our moat and our brand promise. **We will not reverse this decision.**

Post-mutual-click coordination happens through the **Proposal UI**: a structured interface where either user can confirm the suggested shared event, or propose up to 3 alternatives from the Click catalogue. No free-text input anywhere.

---

## 2. Who Our Customers Are

### 2.1 Users — The People We Serve

| Segment | Who they are | Why they need Click | Where we find them |
| --- | --- | --- | --- |
| **Primary** (25–38, inner Sydney) | Young professionals in Surry Hills, Newtown, Marrickville, Darlinghurst, Redfern, Glebe, Alexandria. Mix of overseas-born, interstate movers, and long-term Sydneysiders with stagnant social circles. | No existing local social network, or existing network has contracted post-COVID / post-major-life-event (new city, new job, breakup, divorce). | Reddit (r/sydney, r/expats), Facebook groups (New to Sydney, Brits in Sydney, Sydney Indians, Sydney Girlies), TikTok, Instagram, PR |
| **Secondary** (38–50, inner Sydney) | Established professionals. Often post-divorce, post-relocation, or career-changed. Social circle contracted. | Willing to pay for quality experiences. Event format suits their preference for structured rather than spontaneous social situations. | Same channels + LinkedIn, targeted Meta ads, word of mouth from primary cohort |
| **High-priority sub-segment** | Recent overseas arrivals to Sydney (43.2% of Sydney is overseas-born). Arrive with zero social network. Actively seeking community. | Highest urgency, highest activation intent. Will try a new platform because the alternative is staying home. | International student / expat Facebook groups, university noticeboard partnerships, international community organisations |

### 2.2 Merchants — Our Supply Side

Merchants are event hosts: small-to-medium Sydney businesses who run bookable experiences. They are both a revenue source (commission + subscription) and a distribution channel (their existing customers become our users).

| Category | Why they are right for Click | Sydney examples |
| --- | --- | --- |
| Yoga and wellness studios | High repeat attendance; community-focused operators; existing event format; young professional clientele | Studios in Surry Hills, Newtown, Paddington, Redfern |
| Wine bars and small bars | Already host tasting events; social-forward audience; low setup friction; evening availability | Natural wine bars, cocktail class venues, bottle shop tastings |
| Pottery and ceramics | Fastest growing experiential category; highly Instagrammable; appeals directly to our primary demographic | Clayfull, Pinch Pottery, independent studio operators |
| Running and fitness clubs | Strong community identity; already use event formats; outdoor setting reduces venue cost | Inner-city running groups, boot camps, outdoor fitness operators |
| Cooking schools | Intimate by design; shared task creates natural conversation; broad demographic appeal | Small-group cooking classes, chef-hosted dinner experiences |
| Trivia and game nights | Already structured social format; low-friction entry; reliably repeatable | Pub quiz operators, board game cafes, escape room companies |
| Arts and creative workshops | Sip-and-paint, life drawing, crafts — shareable, aspirational, social-media-friendly | Independent artist-hosts, gallery spaces, creative studios |

---

## 3. How We Get Customers

We have two customer types to acquire simultaneously and in a specific order. **Merchants come first. Users come second.** A platform with no events is not a platform — and Sydney users will not give a sparse product a second chance.

### 3.1 Getting Merchants — The Supply Side

> **MERCHANT ACQUISITION RULE**
> Merchant acquisition is a sales process, not a marketing process. Cold email conversion for small business owners is under 3%. Warm introductions and in-person visits convert at 30–40%. Do not send emails. Go to their venues. Take their classes. Talk to them as a customer first.

#### Phase 0 — Founding Merchant Recruitment (Weeks 1–12)

**Target: 35 founding merchants signed before any user is invited.** The deal:

- **6 months free** — no subscription fee, no commission on first 20 bookings
- **White-glove onboarding** — Click team builds the event listing for them (this removes every friction point)
- **Founding Partner badge** on their profile and in all launch marketing
- **Featured placement** in the first 3 months of the event feed

**How to find them:**

- Walk the streets of Surry Hills, Newtown, Marrickville — go to yoga classes, pottery studios, wine bars. These are 10-minute conversations, not 30-minute pitches.
- Instagram and Google Maps search for the 7 target categories in the 6 target suburbs. Build a list of 150 prospects. Prioritise businesses with 200–2,000 Instagram followers (large enough to have an audience, small enough that we are valuable to them).
- Ask each merchant you sign to introduce you to two others in their network — adjacent businesses, not direct competitors. This is the fastest channel.

#### The Merchant Pitch — What to Say

> **THE MERCHANT PITCH (verbatim)**
> "Your current customers already love you. Click gives you a second audience — the 200,000 Sydneysiders looking for exactly what you do who just haven't found you yet. They are pre-qualified by interest, they're willing to pay, and they're trying to meet people. We bring them to your door. We only earn when you earn — 10% on bookings we generate. Your first 6 months are completely free. No subscription, no risk."

#### Handling the 4 Most Common Merchant Objections

| Objection | What they mean | Your response |
| --- | --- | --- |
| "I already use Eventbrite / ClassBento." | They're comfortable with the familiar. | Eventbrite shows you to people searching for events. Click shows you to people searching for connection — a different, more motivated buyer. We are not replacing your existing tools, we are adding a social discovery layer they don't have. |
| "I don't want Click taking 10%." | They're worried about margin. | We only earn on bookings we generate. Your direct bookings, your existing customers — we never touch those. And in the first 6 months, the commission is zero. You have nothing to lose and a new audience to gain. |
| "I don't have time to manage another platform." | They're time-poor. | We handle it. Your first event listing is built by us. After that, it takes 10 minutes to add a new event. We send you attendee data, reminder emails, and payment — you just show up and run your event. |
| "How many users do you have?" | They want proof of audience. | We are launching with a curated waitlist of [X] users in inner Sydney. We are also being featured in Broadsheet and Time Out at launch. You will be among the first merchants on the platform — your events will be prominently placed in a growing audience from day one. |

### 3.2 Getting Users — The Demand Side

#### Channel 1 — Organic Community (Free, Highest Trust, Start Now)

Sydney has active online communities of exactly the people we serve. The strategy is authentic participation, not advertising.

| Platform | Community / group | Approach |
| --- | --- | --- |
| Reddit | r/sydney, r/sydneyexpats, r/australia | Founders post authentically about building Click. Answer "how do I make friends in Sydney?" threads. Be the person who built the solution — never the person spamming a link. |
| Facebook Groups | New to Sydney, Brits in Sydney, Sydney Indians, Sydney Girlies, French in Sydney, South Africans in Sydney | Join and participate for 2 weeks before mentioning Click. Share the product only when someone asks directly about making friends or finding events. |
| TikTok | Create founder-story content | Format: "POV: I moved to Sydney and knew nobody. I tried everything. Nothing worked. So I built something." Authentic, unpolished, filmed on a phone. This is the highest-performing format for this audience. |
| Instagram | @clicksydney account | Event content (beautiful visuals from merchant partners), founder story Reels, user testimonials as they come in. Consistency beats volume — 4 posts per week minimum. |

#### Channel 2 — Pre-Launch Waitlist (Target: 2,500 before launch)

- Build a single landing page: headline ("Sydney is the third worst city in the world for making friends. We built something about that."), email capture, founder story, 3 example events.
- Drive traffic via the community channels above and via merchant partners sharing the waitlist link with their existing customers.
- Waitlist email sequence: 5 emails over the wait period — founder story, how it works, first event preview, social proof, launch invite.
- **Goal: 2,500 emails before Phase 1 launch.** This is the minimum for a meaningful invite-only mechanic.

#### Channel 3 — PR and Earned Media (Free, High Impact)

The "Sydney ranked third worst for making friends" story is still alive and resonant. A new platform built specifically to solve it is a ready-made media story.

| Outlet | Target section | Pitch angle |
| --- | --- | --- |
| Time Out Sydney | News / things to do | Sydney ranked 3rd worst for making friends. We built Click. Here's the launch event. |
| Broadsheet Sydney | Neighbourhoods / new openings | Platform launches connecting inner-Sydney locals through shared experiences — not apps, not chat. |
| SMH / The Age Lifestyle | Life & relationships | The loneliness crisis in Sydney — and the two founders who built a response to it. |
| ABC Everyday | Life / wellbeing | Adult friendships in 2026 — why it's so hard and what actually works. |
| Junkee | Culture / tech | The Sydney app that wants to fix the city's friendship problem without making you swipe. |

**Approach:** email the journalist directly, not the press inbox. 3-sentence email: the data point, the solution, the founder story. Attach nothing. Ask if they want to know more. Follow up once after 5 days.

#### Channel 4 — Micro-Influencer Partnerships (Month 1–3)

- **Target:** 10–15 Sydney creators with 5K–50K followers in wellness, lifestyle, "things to do in Sydney", expat content, or food/drink.
- **Offer:** founding member access, $200–500 event credits, 10% affiliate commission on verified signups via their unique link.
- **What we want from them:** one genuine post or Reel after attending a Click event — not scripted, not paid-for-opinion, just real experience content.
- **Where to find them:** Instagram search "things to do sydney", "sydney events", "new to sydney" — look at who's posting, not just who has followers.

#### Channel 5 — Paid Acquisition (Month 4 onwards, after organic proof)

> **PAID ACQUISITION RULE**
> Do not spend money on paid ads until you have evidence the organic funnel converts. Paid acquisition scales a working funnel. It does not fix a broken one. Start paid only when: onboarding completion rate > 60%, first-RSVP conversion > 25%.

| Channel | Targeting | Daily budget | What success looks like |
| --- | --- | --- | --- |
| Meta (Instagram / Facebook) | Age 26–38, Sydney metro (10km radius of Surry Hills), interests: yoga, pilates, wine, cooking, hiking, pottery, trivia | $50/day to start | CAC < $15 per activated user (signed up + 1 RSVP). Scale when hit. |
| TikTok ads | Age 22–35, Sydney, interest in wellness / social / lifestyle | $30/day | Click-through to waitlist > 3%. Scale when hit. |
| Retargeting | Website visitors who did not sign up, abandoned onboarding | $20/day | Completion rate lift > 15% vs no retargeting |

#### Channel 6 — Merchant-Driven Discovery (Ongoing)

Every merchant who lists on Click is a distribution channel. Their existing customers see Click when they book, and in the venue. Provide every merchant with:

- Co-branded "Find us on Click" digital asset for their Instagram story, email newsletter, and Google Business profile
- A QR code for their physical space linking to their Click profile
- A draft email they can send to their existing customer list announcing they are now on Click

This is the lowest-cost, highest-trust acquisition channel we have. A recommendation from a yoga studio you already love carries more weight than any ad.

---

## 4. How We Keep Customers

Acquisition gets users in the door. Retention determines whether we have a business or a leaking bucket. **Our target: 40% of Month 1 users still active in Month 6.** Here is exactly how we get there.

### 4.1 The Retention Problem We Must Solve

> **THE CRITICAL DROP-OFF WINDOW**
> The highest-risk moment is the gap between signup and first event attendance. A user who signs up, browses, finds nothing compelling, and never books is gone forever. In Sydney especially — users will not give a platform a second chance. Every product and content decision in the first 30 days is about closing this gap.

### 4.2 Onboarding Retention — Getting to First RSVP

| Step / Problem | Problem | Fix |
| --- | --- | --- |
| Tag selection (Step 3) | Wall of text tags feels like admin, not discovery | Visual grid with icons per category; max 3 required, 10 recommended; show instantly how tags affect the event feed |
| No events match their tags | Cold-profile new user sees irrelevant suggestions and bounces | Editorial fallback feed: curate 20 high-quality inner-Sydney events visible to all new users regardless of match score, until they have attended their first event |
| First event looks too intimidating | Large group events feel scary for people already anxious about social situations | Surface intimate events first (8–20 person capacity) for new users; larger events after first attendance |
| Price friction on first booking | Paid event as first experience creates hesitation | Offer one $20 event credit to users who complete onboarding — applies to their first booking only; funded from marketing budget not merchant commission |
| No context on who will be there | User cannot evaluate whether the event is "for people like me" | FOMO cards must be live from Day 1: "Mostly 25–35 attending", "Popular with people who like yoga and wine", "4 people with your interests are going" |

### 4.3 Post-First-Event Retention — Getting to Second

The data on social apps is consistent: if a user does not take a second action within 7 days of their first, they rarely return. The post-event window is the most valuable retention moment we have.

| Trigger | Action | Goal |
| --- | --- | --- |
| 12 hours after event ends | In-app and push notification: "Did you click with anyone at [Event Name]?" with a simple attendee list and one-tap click button | Activate the social mechanic for the first time; create emotional investment in the outcome |
| 24 hours after event ends | Email: "Here's what's coming up that people like you are attending" — 3 personalised event suggestions | Bring user back to the feed while the event experience is still fresh |
| 7 days after first event | If no second RSVP: notification — "Someone with your interests is attending [Event] this weekend. Only 4 spots left." | FOMO + urgency; last chance to re-engage before the 7-day window closes |
| Mutual click fires | Both users receive: "You both connected at [Event]. Here's something you might want to do together." — the Proposal UI opens | The platform's highest-value moment; must feel warm and special, not automated |
| 14 days of inactivity | Reactivation email: "You haven't been to an event in a while. Here's what's happening in [suburb] this week." | Soft re-engagement; no pressure; just visibility |

### 4.4 Long-Term Retention — Keeping Users for 6+ Months

| Mechanic | What it does | Why it works |
| --- | --- | --- |
| Weekly digest email | Every Sunday: 5 personalised events for the coming week, personalised by tags and past RSVPs | Creates a habit loop — users open the email, see something they want, book. Consistent week-on-week touchpoint. |
| Activity feed on dashboard | Shows activity from users with overlapping tags: "[Name] attended Trivia Night", "3 people you might click with saved Saturday Pottery" | Social proof and FOMO without direct messaging; makes the platform feel alive even between events |
| Post-event feedback card | After each attended event: "Did you meet anyone you'd want to see again?" — drives mutual click activation | Every attended event is an opportunity to generate a mutual click; feedback card is the prompt |
| Click Plus subscription features | Seeing who's attending before RSVPing; 14-day match window; priority waitlist | Creates a reason for highly engaged users to pay monthly; Click Plus users have significantly higher retention than free users (incentive is aligned) |
| Milestone notifications | "You've attended 5 events on Click" / "You've made your first mutual click" | Light gamification; acknowledges progress without being cringeworthy; reinforces positive behaviour |

### 4.5 Merchant Retention — Keeping the Supply Side

Merchant churn is as dangerous as user churn. A merchant who leaves takes their events, their audience, and their word-of-mouth with them. **Target: less than 10% monthly merchant churn.**

| When | Action | What it prevents |
| --- | --- | --- |
| Week 2 after onboarding | Check-in call or message: "How did your first event go? Any questions about the platform?" | Early churn from confusion or unmet expectations — the most common cause |
| Before free period ends (Month 5) | Merchant performance review: show them exactly how many new customers came via Click, revenue generated, demographic breakdown of attendees | Churn at the free-to-paid transition — the second most common cause. If we can show AUD $500+ in incremental revenue, the $79/month subscription is obvious ROI. |
| Monthly (ongoing) | Analytics email: "Here's your Click performance this month" — RSVPs, revenue, audience insights | Passive churn from merchants who forget about the platform; keeps Click visible and valuable |
| When event is under-attended | Proactive message: "Your Saturday event has 3 spots left — want us to feature it in this week's push notifications?" | Merchant frustration with low attendance; shows Click is actively working for them, not just taking a listing fee |
| At 3-month mark | Invite to founding merchant case study: feature their story in Click's PR and social content | Creates loyalty and advocacy; merchants who are publicly associated with Click's success are less likely to leave |

---

## 5. How We Make Money

Four revenue streams that activate in sequence. No single stream carries the whole business — if one grows slowly, the others compensate. This is deliberate.

### 5.1 Stream 1 — Transaction Commission (from Month 1)

- 8–12% commission on all Click-managed paid event bookings, processed via Stripe
- Applies only to events where Click is the booking authority — not external bookings
- Merchant receives net payout automatically via Stripe Connect
- **Example:** 1,500 RSVPs/month × $45 average ticket × 10% = **$6,750/month** by Month 12

### 5.2 Stream 2 — Merchant Subscriptions (from Month 4)

| Tier | Fee | What merchants get |
| --- | --- | --- |
| Free | $0 / month | 2 events/month, basic analytics, standard listing placement |
| Growth | $79 / month | Unlimited events, full analytics dashboard, audience reach data, tag-based targeting, priority placement in feed |
| Pro | $199 / month | Everything in Growth, plus FOMO targeting, attendee demographic export, featured carousel placement, dedicated support |

### 5.3 Stream 3 — Click Plus User Subscription (from Month 7)

- $12.99 / month or $99 / year
- Features: see the attendee list before booking, 14-day mutual click window (vs 7 days free), priority waitlist position, advanced event filters, weekly personalised digest
- **Target 8–12% of MAU on Click Plus by Month 12**

### 5.4 Stream 4 — Promoted Event Placement (from Month 9)

- Merchants pay $49–149 per event for featured placement in the Suggested feed and Click Radar carousel
- Flat fee per event — not auction-based. Quality of events in promoted slots matters more than yield at this stage.

### 5.5 Revenue Projections

| Month | Commission | Merchant subs | Click Plus | Promoted | Total MRR |
| --- | --- | --- | --- | --- | --- |
| Month 3 | $900 | $0 | $0 | $0 | $900 |
| Month 6 | $2,250 | $2,417 | $0 | $0 | $4,667 |
| Month 9 | $4,500 | $4,758 | $390 | $490 | $10,138 |
| Month 12 | $6,750 | $6,900 | $779 | $980 | $15,409 |

> **FINANCIAL CONTEXT**
> **Bear case** (if RSVPs and merchant conversions run 30% below projections): Month 12 MRR ~$9,800 — still sufficient for a credible Series A conversation.
>
> **Break-even on monthly burn:** Base case Month 14 | Optimistic Month 11 | Bear Month 18 (needs bridge funding)
>
> **Gross margin target:** 65%+ after Stripe fees (2.9% + $0.30/transaction), Supabase, and Resend.

---

## 6. Launch Plan — Phase by Phase

### 6.1 Phase 0 — Foundation (Weeks 1–12, before any users)

> **PHASE 0 GATE — NON-NEGOTIABLE**
> The platform must have 35 active merchants and 15+ events per week listed before a single user is invited. No exceptions. A platform with no events is not a platform.

| Task | Owner | Done when |
| --- | --- | --- |
| Incorporate Pty Ltd + obtain ABN | Co-founder 1 | ASIC confirmation received |
| Sign developer agreement (IP assignment or co-founder docs) | Co-founder 1 + developer | Document signed by all parties |
| Engage startup lawyer — T&Cs, merchant contract, shareholder agreement | Co-founder 1 | All documents drafted and reviewed |
| Refund and cancellation policy written and published | Co-founder 1 + lawyer | Live on website before first ticket sold |
| Stripe Connect tested end-to-end with real payment | Developer | Successful test transaction confirmed |
| Block, mute, and report mechanic live in product | Developer | Tested and working in staging |
| Safety policy for dating mode written and published | Co-founder 1 | Live on website before dating mode opens |
| Waitlist landing page live with email capture | Developer | URL accessible; email capture sending to list |
| 35 founding merchants signed | Co-founders | 35 signed agreements on file |
| 200+ events listed in first 60-day calendar | Co-founders + merchants | Events visible in admin dashboard |
| 2,500 waitlist signups | Co-founders | Email list count confirmed |
| 12 seed users identified and briefed | Co-founders | Names, contact details, briefing notes on file |

### 6.2 Phase 1 — Controlled Launch (Months 1–3)

**Invite mechanic:** Invite-only launch. Release 200 waitlist spots per week. Prioritise: new-to-Sydney users (highest need), inner-east and inner-west postcodes (geographic density improves match quality), diverse interest tag spread (seeds the matching graph deliberately).

**Flagship launch event — Sydney Strangers**

- 100-person evening at a well-known inner-Sydney venue (target: a Surry Hills or Newtown venue with an existing Click merchant partner)
- Framed as a social event, not a product launch: "An evening for people who want more friends in Sydney" — the platform is the means, not the message
- 80 tickets sold through Click. 20 reserved for press, seed users, and merchant partners.
- Seed users attend and post organic content — no scripted posts, genuine experience only
- Cost: approximately $3,000–5,000 (venue hire, catering, staff). Recoverable via ticket sales at $40/head.

**PR push — Week of launch**

- Pitch Time Out Sydney, Broadsheet, SMH Lifestyle simultaneously — do not wait for one before approaching others
- Offer an exclusive to one outlet if needed to secure coverage. Time Out is the priority — their readership is exactly our user.
- Target: at least 1 piece of earned media live the week of launch. 3+ within the first month.

| Week 1–2 KPIs | Target | If not hit |
| --- | --- | --- |
| Waitlist users who activate (complete onboarding) | 70%+ of invited users | Diagnose onboarding drop-off before releasing more spots |
| Activated users who RSVP to at least 1 event | 30%+ within first week | Check event quality and FOMO card visibility; offer first-event credit |
| Launch event tickets sold | 80 of 80 available | Push harder on PR and seed user network; reduce price if needed |
| Merchant NPS after first month | 7+ out of 10 | Individual calls to all founding merchants; identify and fix complaints before Month 2 |

### 6.3 Phase 2 — Open Growth (Months 4–6)

- Remove invite gate — open public signup
- Launch merchant subscription tiers — offer founding merchants discounted Growth at $49/month for their first paid month
- Launch Meta paid acquisition at $50/day — scale only when CAC < $15
- Launch referral mechanic: both referrer and new user get $10 event credit when the referred user attends their first event
- Begin weekly curated email digest — "What's on for people like you this week in Sydney"
- Approach corporate HR teams about "Click for Teams" — companies buying event credits for staff social connection

### 6.4 Phase 3 — Monetisation (Months 7–12)

- Launch Click Plus subscription ($12.99/month)
- Introduce promoted event placement for merchants ($49–149 per event)
- Expand to CBD and North Shore once inner-suburb MAU exceeds 500
- Produce 3 merchant case studies — quantified ROI stories for PR and investor materials
- Begin Vietnam market research and contact validation (does not affect Sydney operations)

---

## 7. Technology — What We Are Building

This section is for the developer. It documents what needs to be built, in what order, and where the current MVP needs to be hardened before Phase 1 launch.

### 7.1 The Stack

| Layer | Technology | Why |
| --- | --- | --- |
| Frontend | React 18 + TypeScript + Vite | Fast build, strong typing, well-documented. Our developer already knows this. |
| Styling | Tailwind CSS + shadcn/ui | Consistent design system; rapid component development; accessible by default |
| Backend / DB | Supabase (PostgreSQL + Row Level Security) | Auth, database, realtime, storage, edge functions in one platform. No separate backend server to maintain. |
| Payments | Stripe + Stripe Connect | Industry standard; merchant payout handled automatically; strong AU compliance |
| Email | Resend | Reliable transactional email; good deliverability; simple API |
| Maps | Mapbox | Event locations, distance filtering, proximity-based recommendations |
| Hosting | Supabase (database) + Vercel or Netlify (frontend) | Both have generous free tiers; easy deploy; good performance in AU |

### 7.2 What Must Be Hardened Before Phase 1 Launch

> **LAUNCH BLOCKERS**
> These are not nice-to-haves. The platform cannot accept real users or real money without all of these.

| Feature | Current state | Required state before launch | Priority |
| --- | --- | --- | --- |
| IP assignment | Informal arrangement | Signed contract or co-founder agreement assigning all code to company entity | This week — blocks everything |
| Stripe payment flow | In development | End-to-end tested: user books, payment processes, RSVP confirmed, merchant notified, payout scheduled | Critical |
| Row Level Security (RLS) | In development | All tables audited — users can only see their own data; merchants see only their events; admin has full access | Critical |
| Block / mute / report | Not built | User can block another user from seeing them; mute disables notifications from that user; report sends to admin queue with 24hr SLA | Critical — must be live before dating mode |
| Refund flow | Not built | Admin or merchant can trigger full or partial refund via Stripe; user receives email confirmation; booking status updates | Critical |
| Waitlist and capacity management | Partial | When event hits capacity, RSVP switches to waitlist; first waitlist user gets 15-min window when spot opens; window expiry re-offers to next in queue | High |
| Email notifications | Not built | RSVP confirmation, waitlist promotion, mutual click notification, event reminder (24hr before), post-event feedback prompt (12hr after) | High |
| Proposal UI (post-mutual-click) | Not built | When mutual click fires: both users see shared event suggestion; either can confirm in one tap; "suggest alternative" opens Click catalogue search (no free text); 7-day expiry | High |
| Editorial fallback feed | Not built | New users with readiness score < 40% see a curated popular events feed instead of empty/low-quality algorithm output | High |
| FOMO cards | Partial | Live tag-based crowd composition signals on every event card: demographic breakdown, interest overlaps, attendee count | High |
| Merchant analytics dashboard | Partial | Real Supabase data only — no mock data in production. Revenue, RSVPs, conversion rate, attendee demographics. | Medium |
| Admin audit log | Not built | All admin actions (approve/reject merchant, remove user, override event) logged with timestamp and admin user ID | Medium |

### 7.3 The Race Condition We Must Fix

> **RACE CONDITION — CAPACITY OVERBOOKING**
> **Current issue:** when an event is nearly full, two users can both see "1 spot left", both complete checkout, and both get confirmed — creating an overbooked event.
>
> **Fix required before any paid event goes live:**
> 1. When a user begins checkout, reserve the spot with a `pending_booking` record (status = reserved)
> 2. Set a 10-minute expiry on the reservation
> 3. Stripe webhook on payment success: convert reserved → confirmed
> 4. Stripe webhook on payment failure or timeout: release the reservation back to available capacity
> 5. The RSVP button must query available capacity (total − confirmed − reserved), not just (total − confirmed)
>
> This is a Postgres-level fix, not an external service. A partial index on `event_bookings` with a CHECK constraint on capacity is sufficient.

---

## 8. Team and Roles

| Role | Person | Responsibilities | Formalised as |
| --- | --- | --- | --- |
| Co-Founder / CEO | [Name] | Strategy, investor relations, merchant acquisition, PR, product vision, legal and compliance | Equity co-founder — shareholders agreement |
| Co-Founder | [Name] | Growth, community, content, user acquisition, merchant onboarding, operations | Equity co-founder — shareholders agreement |
| Technical Lead / Developer | [Name — friend] | MVP build, all engineering, Supabase architecture, Stripe integration, ongoing platform development | To be formalised: either equity co-founder (10–25%) with vesting, or paid contractor with IP assignment — decision required this week |

### 8.1 Roles to Hire (Post Pre-Seed Funding)

| Role | When | Why | Budget |
| --- | --- | --- | --- |
| Growth and Community Lead | Month 2–3 | Co-founders cannot run merchant acquisition, content, social channels, and investor conversations simultaneously. First non-technical hire. | $80–95K/year |
| Merchant Success Manager | Month 5–6 | Merchant retention is as important as merchant acquisition. Dedicated person for check-in calls, analytics review, upsell to paid tiers. | $75–85K/year |
| Part-time Community / Events Coordinator | Month 4–5 | Event calendar quality, seed user programme, Click-owned events management. | $45–55K/year (part-time) |

### 8.2 Advisory Board — Recommended

| Advisor type | What they bring | How to find them |
| --- | --- | --- |
| AU startup operator (Series A+ background) | Investor introductions, fundraising process credibility, operational experience | Startmate alumni network, LinkedIn, introductions from early angels |
| Sydney events / hospitality industry veteran | Merchant credibility, warm intros to first merchants, event ecosystem knowledge | Direct outreach to operators you respect in the space |
| Consumer app / social platform background | Product strategy, retention mechanics, growth playbook for two-sided marketplace | AngelList, Startmate, direct LinkedIn outreach |

---

## 9. Financials and Funding

### 9.1 Current Position

| Item | Status |
| --- | --- |
| Total invested to date | Under $50,000 AUD (founder capital) |
| Runway remaining | 3–6 months at current burn |
| Monthly burn (estimated) | $5,000–15,000 depending on developer arrangement |
| Revenue to date | $0 — pre-launch |
| Funding status | Bootstrapped; no external investors yet |

### 9.2 What We Need and When

| Round | Amount | Timeline | Purpose | Structure |
| --- | --- | --- | --- | --- |
| Bridge / immediate | $30–80K | This month | Extend runway to 12 months; cover legal fees, incorporation, immediate tech costs | Friends & family SAFE note or personal loan |
| NSW MVP Grant | Up to $25K | Apply now (6–10 week process) | Non-dilutive top-up; no equity given up | Grant — free money |
| Pre-seed / angel | $150–400K | Month 2–4 (post-MVP demo) | Phase 1 launch costs, first hire (growth lead), marketing budget, 18-month runway | SAFE note at $2–4M cap |
| Seed / Series A | $2–6M | Month 12–15 | Multi-city expansion, ML matching engine, team scale | Priced equity round |

### 9.3 Monthly Burn by Phase

| Cost | Phase 0–1 (Months 1–3) | Phase 2 (Months 4–6) | Phase 3 (Months 7–12) |
| --- | --- | --- | --- |
| Team (salaries / contractor) | $8,000–18,000 | $22,000 | $28,000 |
| Technology (Supabase, Stripe, Mapbox, Resend) | $3,500 | $4,500 | $6,000 |
| Marketing and acquisition | $2,000 | $8,000 | $10,000 |
| Merchant ops and events | $3,000 | $2,500 | $2,000 |
| Legal, admin, compliance | $3,000 | $1,500 | $1,500 |
| **Total monthly burn** | **$19,500–31,500** | **$38,500** | **$47,500** |

> **Note:** Phase 0–1 burn range reflects uncertainty in developer arrangement cost (equity = lower cash burn; paid contractor = higher). Resolving the developer situation this week resolves this range.

### 9.4 Unit Economics Targets

| Metric | Target at Month 12 | What drives it |
| --- | --- | --- |
| Customer Acquisition Cost — user | < $20 AUD blended | Organic channels (free) weighted against paid Meta/TikTok ($35 CAC); organic must be 60%+ of total volume |
| Customer Acquisition Cost — merchant | < $150 AUD | Founder in-person outreach + founding merchant events cost divided by merchants acquired |
| Lifetime Value — user | $80+ AUD (18-month) | Avg $4.50/month blended spend (commission share + Click Plus) × 18-month retention |
| Lifetime Value — merchant | $1,100+ AUD (14-month) | $79/month Growth tier × 14-month avg retention |
| LTV:CAC ratio — user | 4:1 minimum | Below 3:1 and the business is not sustainable |
| LTV:CAC ratio — merchant | 7:1 target | Strong B2B SaaS benchmarks; achievable with our cost of merchant acquisition |
| Gross margin | 65%+ | After Stripe 2.9% + $0.30, Supabase, Resend; before team costs |

---

## 10. KPIs and Milestones

| Milestone | Target date | KPI | Status if missed |
| --- | --- | --- | --- |
| Developer arrangement formalised | This week | Signed document in place | Existential risk — stops everything else |
| Company incorporated + ABN | Week 2 | ASIC confirmation | Cannot sign contracts or take investment |
| Legal docs complete (T&Cs, merchant contract, refund policy) | Month 1 | All documents live on website | Cannot onboard merchants or sell tickets |
| Waitlist landing page live | Month 1 | URL accessible with email capture | Delay costs waitlist momentum |
| 15 founding merchants signed | Month 2 | 15 signed agreements on file | Delay Phase 0 gate by 2 weeks |
| 35 founding merchants signed | Month 3 | 35 signed; events listed | Hard launch gate — do not open to users until hit |
| 2,500 waitlist signups | Month 3 | Email list count | Reduce invite pace if under 1,500 at launch |
| Phase 1 launch event (Sydney Strangers) | Month 4 | 80 tickets sold | Reassess event format and price |
| 500 activated users | Month 5 | Onboarded + 1 RSVP completed | Diagnose onboarding drop-off; offer first-event credit |
| First mutual click | Month 4–5 | 1+ mutual click in production | Product milestone and team signal — should happen naturally if event quality is right |
| 25 paying merchant accounts | Month 6 | Growth or Pro tier | Extend free period; revisit value prop conversations |
| 300+ MAU | Month 6 | Monthly active users (1 action in 30 days) | Accelerate paid acquisition if under 200 |
| Merchant NPS > 7 | Month 6 | Post-onboarding NPS survey | Individual calls to all merchants below 7 |
| $15,000+ MRR | Month 12 | Combined revenue streams | Series A minimum — bear case is $9,800 which is still pitchable |
| Melbourne waitlist 1,000+ | Month 10 | Email signups from Melbourne postcodes | City 2 proof point for Series A |

---

## 11. Risks and How We Manage Them

| Risk | Likelihood | Impact | What we watch for | What we do |
| --- | --- | --- | --- | --- |
| Developer walks / IP dispute | High (informal) | Critical | Any sign of friction or reduced engagement | Formalise this week. No delay. |
| Not enough events at launch | High | Critical | Merchant count < 25 by Week 8 | Hard gate: 35 merchants before any user invited |
| Runway runs out before traction | High | Critical | Monthly burn > $10K with no investor progress | Bridge now; NSW grant application this week; merchant onboarding fee |
| Sydney users browse but never book | Medium | High | < 25% first-RSVP conversion in Week 1 | Editorial fallback feed; first-event credit; reduce ticket friction |
| Merchants churn at end of free period | Medium | High | NPS drops below 6 in Month 4 | Demonstrate ROI before free period ends; monthly check-in calls |
| Capacity overbooking on paid events | High (if unfixed) | High | Any duplicate booking in test environment | Fix the `pending_booking` race condition before first paid ticket |
| Safety incident in dating mode | Low | Very high | Any user report of unwanted contact | Safety policy live; block/mute at launch; 24hr incident SLA; legal briefed |
| Competitor launches similar product | Medium | Medium | Any AU press coverage of similar platform | Speed and data flywheel are the moat — move fast |
| No technical co-founder — can't scale | High (if unresolved) | High | Any feature request taking > 3 weeks | Resolve developer arrangement; identify fractional CTO if needed |

---

## 12. Phase 2 — Vietnam Expansion

> **SCOPE NOTE**
> Vietnam is Phase 2. It does not affect Sydney launch planning. Nothing in this section is actioned until Sydney reaches Phase 2 KPIs. It is included here so all three team members understand the direction.

### 12.1 Why Vietnam

- We have existing merchant contacts in Ho Chi Minh City — this solves the hardest part of any expansion (merchant cold start)
- ~100,000 Western expats in HCMC with the same social connection need as Sydney's overseas-born cohort
- Zero comparable competitor operating in Vietnam at any scale — first-mover advantage still available
- Growing young professional class aged 22–40 who are internationally connected and event-active
- English-first MVP is viable for launch with the expat and young professional community

### 12.2 What Must Be True Before We Start

- Sydney has reached 300+ MAU and 25+ paying merchants (Phase 2 KPIs)
- Minimum 5 HCMC merchant contacts confirmed as willing to list events on Click
- Stripe Connect confirmed operational for Vietnamese merchants, OR local payment alternative (VNPay, MoMo) integrated
- Preliminary legal review of Vietnamese platform regulations complete — no regulatory blocker identified
- Local community manager identified in HCMC — remote management of market 2 does not work

### 12.3 If Vietnam Validation Fails

If our HCMC contacts cannot commit to listing, or there is a regulatory or payment blocker, Melbourne becomes market 2. Melbourne is a safe, fast expansion on the same legal infrastructure with no language barrier. Vietnam then moves to Year 3. This is not a failure — it is a contingency.

---

## 13. What We Do Next — The 90-Day Plan

### Days 1–7 — Non-Negotiable

| Action | Owner | Cost |
| --- | --- | --- |
| Have the developer conversation — co-founder or contractor. Decide and commit. | CEO | $0 |
| Engage a startup lawyer — shareholder agreement, IP assignment, T&Cs, merchant contract | CEO | $8–12K AUD total legal package |
| Register Pty Ltd via ASIC + obtain ABN | CEO | $597 ASIC + $0 ABN |
| Apply for NSW MVP Grant | CEO | $0 (takes 2 hrs to complete application) |
| Open business bank account | CEO | $0 |

### Days 8–30 — Build the Foundation

| Action | Owner | Cost |
| --- | --- | --- |
| Waitlist landing page live — headline, email capture, founder story, 3 example events | Developer | $0 (Vercel free tier) |
| Begin merchant outreach — in-person visits, 5 prospects per week minimum | Both co-founders | $0 (time only) |
| Start organic content — TikTok founder story format, Instagram event previews | Co-founder 2 | $0 |
| Begin Reddit and Facebook group community presence (not promotion yet — participation) | Co-founder 2 | $0 |
| Fix the capacity race condition in the booking flow | Developer | $0 (engineering time) |
| Build and test block / mute / report mechanic | Developer | $0 (engineering time) |
| Stripe Connect end-to-end test with a real $1 transaction | Developer | $1 |

### Days 31–60 — Merchant Seeding

| Action | Owner | Cost |
| --- | --- | --- |
| 15 founding merchants signed (target: 25 by Day 60) | Both co-founders | $0 (no upfront merchant cost until free period ends) |
| 100+ events listed in the 60-day forward calendar | Merchants + co-founders | $0 |
| Email pitch to Time Out Sydney, Broadsheet, SMH Lifestyle — founder story + launch date | Co-founder 1 | $0 |
| Identify and brief 12 seed users — confirm attendance at launch event | Co-founders | $200–500 event credits |
| Draft all email notification templates — RSVP confirm, waitlist, mutual click, post-event prompt | Developer + Co-founder 2 | $0 |
| T&Cs, privacy policy, merchant contract, refund policy — all live on website | Lawyer + CEO | Included in legal package |
| Begin friends & family bridge conversation if runway < 5 months | CEO | $0 (time) |

### Days 61–90 — Launch Readiness

| Action | Owner | Cost |
| --- | --- | --- |
| 35 founding merchants signed — launch gate met | Co-founders | $0 |
| 2,500 waitlist signups — launch gate met | Co-founders | $500–1,000 (boosted posts if needed) |
| Launch event venue and date confirmed — Sydney Strangers, 100 people | Co-founders | $3,000–5,000 (recoverable via tickets) |
| All launch-blocker features complete and tested (see Section 7.2) | Developer | $0 (engineering time) |
| First press coverage live or confirmed — Time Out or Broadsheet | Co-founder 1 | $0 |
| Pre-seed investor meetings started — minimum 3 booked | CEO | $0 |
| Platform invite-only soft launch to first 200 waitlist users | All | $0 |

> **THE 90-DAY COST**
> The total cost of the next 90 days is approximately **$15,000–22,000 AUD**. Of that, $8–12K is the legal foundation package — a one-time cost. The rest is the launch event ($3–5K), event credits ($500), and content/marketing ($1–2K).
>
> Everything else is time. The three of us working smart for 90 days. There is nothing in this plan that requires external funding to start. **The funding unlocks scale. The execution starts now.**