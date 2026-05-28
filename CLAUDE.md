# CLAUDE.md

Project guide for Claude Code working in this repo.

## Stack

- Next.js 16 (App Router) + React 19
- NextAuth v5 (beta) for auth
- Postgres via `pg` (no ORM). Hosted on Supabase — **use the pooler host**; direct `db.*.supabase.co` is IPv6-only and won't resolve.
- Tailwind 4
- Stripe for checkout
- Mapbox + Google Maps for geo

## Page URI map

Every route in `src/app`. URI on the left, source file on the right. Use this to navigate — `Cmd+Click` the path.

### Public / marketing

| URI | File |
| --- | --- |
| `/` | `src/app/page.tsx` |
| `/how-it-works` | `src/app/how-it-works/page.tsx` |
| `/discover` | `src/app/discover/page.tsx` |
| `/categories` | `src/app/categories/page.tsx` |
| `/events` | `src/app/events/page.tsx` |
| `/events/[slug]` | `src/app/events/[slug]/page.tsx` |
| `/people` | `src/app/people/page.tsx` |
| `/profile/[userId]` | `src/app/profile/[userId]/page.tsx` |

### Auth & onboarding

| URI | File |
| --- | --- |
| `/login` | `src/app/login/page.tsx` |
| `/signup` | `src/app/signup/page.tsx` |
| `/register` | `src/app/register/page.tsx` |
| `/auth` | `src/app/auth/page.tsx` |
| `/forgot-password` | `src/app/forgot-password/page.tsx` |
| `/post-login` | `src/app/post-login/page.tsx` |
| `/onboarding` | `src/app/onboarding/page.tsx` |
| `/quiz` | `src/app/quiz/page.tsx` |
| `/quiz/life` | `src/app/quiz/life/page.tsx` |
| `/quiz/personality` | `src/app/quiz/personality/page.tsx` |
| `/scale` | `src/app/scale/page.tsx` |

### Authenticated attendee

| URI | File |
| --- | --- |
| `/dashboard` | `src/app/dashboard/page.tsx` |
| `/dashboard/calendar` | `src/app/dashboard/calendar/page.tsx` |
| `/profile` | `src/app/profile/page.tsx` |
| `/profile/edit` | `src/app/profile/edit/page.tsx` |
| `/account-settings` | `src/app/account-settings/page.tsx` |
| `/notifications` | `src/app/notifications/page.tsx` |
| `/bookmarks` | `src/app/bookmarks/page.tsx` |
| `/saved-events` | `src/app/saved-events/page.tsx` (redirect → `/bookmarks`) |
| `/confirmed-events` | `src/app/confirmed-events/page.tsx` |

### Merchant

| URI | File |
| --- | --- |
| `/merchant` | `src/app/merchant/page.tsx` |
| `/merchant/signup` | `src/app/merchant/signup/page.tsx` |
| `/merchant/events/create` | `src/app/merchant/events/create/page.tsx` |
| `/merchant/events/[eventId]` | `src/app/merchant/events/[eventId]/page.tsx` |

### Admin

| URI | File | Page title |
| --- | --- | --- |
| `/admin` | `src/app/admin/page.tsx` | Dashboard |
| `/admin/events` | `src/app/admin/events/page.tsx` | Events Management |
| `/admin/merchants` | `src/app/admin/merchants/page.tsx` | Merchants Management |
| `/admin/members` | `src/app/admin/members/page.tsx` | Attendees Management |
| `/admin/transactions` | `src/app/admin/transactions/page.tsx` | Transactions Management |
| `/admin/tags` | `src/app/admin/tags/page.tsx` | Contents Management |
| `/admin/matching` | `src/app/admin/matching/page.tsx` | Matching Formula |
| `/admin/audit` | `src/app/admin/audit/page.tsx` | Audit Log |
| `/admin/system` | `src/app/admin/system/page.tsx` | System |

Admin layout: `src/app/admin/layout.tsx`. Sidebar nav: `src/components/admin-sidebar.tsx`.

### Dev / internal

| URI | File |
| --- | --- |
| `/tables` | `src/app/tables/page.tsx` |
| `/test` | `src/app/test/page.tsx` |

## API routes

Mounted under `src/app/api/**`. Notable groups:

- `api/auth/[...nextauth]` — NextAuth handler
- `api/admin/events`, `api/admin/events/[eventId]/approve`, `api/admin/merchants/[merchantId]/verification`, `api/admin/tags`
- `api/events`, `api/events/[eventId]`, `api/events/[eventId]/{bookmark,checkout,register}`
- `api/merchant/events`, `api/merchant/events/[eventId]/cancel`
- `api/tables`, `api/tables/[table]/rows` — generic admin table CRUD
- `api/test/cases`, `api/test/cases/[id]/comments`, `api/test/comments/[id]`
- `api/clicks`, `api/onboarding`, `api/webhooks/stripe`

## Conventions

- Whenever you add a new page under `src/app/**/page.tsx`, append it to the URI map above.
- Server queries go through `src/lib/postgres.ts` / `src/lib/event-repository.ts` — use the pool, never spawn a new `pg.Client`.
- Auth helpers in `src/lib/last-login.ts` and the NextAuth config; use server-side session for protected pages.
