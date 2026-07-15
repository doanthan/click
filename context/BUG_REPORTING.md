# Bug reporting: screenshot → Postgres → Google Sheets

How the in-app **Report a Bug** widget works, what it captures, and how a report ends up as a coloured row on the Google Sheets triage board that the AI fixer works from.

> **There is no separate "feature request" path.** The widget files everything as a bug (`support_tickets.type` is a column, but the client hard-codes `'bug'` and the API never reads it). A feature request is just a bug row whose "What is wrong" says what's missing. If you want a real feature type, it's a `type` select in the panel + a column on the sheet — nobody's built it.

---

## 1. The moving parts

| File | Job |
| --- | --- |
| `src/components/support/support-widget.tsx` | The floating button + off-canvas panel. Mounted in `src/app/layout.tsx:114` — **logged-in users only** (`session?.user ? <SupportWidget /> : null`). |
| `src/lib/support-capture.ts` | **Always-on** console + failed-network buffer. Side-effect import; starts recording as soon as the widget module loads. |
| `src/lib/support-screenshot.ts` | Viewport screenshot via `html2canvas-pro` (dynamically imported). |
| `src/app/api/support/ticket/route.ts` | `POST` file a bug · `GET ?url=` list open bugs for a page. |
| `src/app/api/support/ticket/[ticketRef]/route.ts` | `PATCH` — mark fixed / send back to AI / edit in place. |
| `src/app/api/support/ticket/[ticketRef]/screenshot/route.ts` | Public 302 → the stored screenshot. This is the link that lives in the Sheet. |
| `src/lib/support-repository.ts` | Postgres source of truth + orchestration of the storage/Sheets side-effects. |
| `src/lib/support-storage.ts` | Uploads the JPEG to Supabase Storage (public `avatars` bucket, `support/` prefix). |
| `src/lib/support-sheets.ts` | The Google Sheets triage board: append, recolour, update. |
| `scripts/read-bugs.mjs` / `scripts/mark-ai-fixed.mjs` | The AI fixer's read + write-back CLI. |
| `database/037` + `038` + `039` | The `support_tickets` table and its triage columns. |

---

## 2. What gets captured, and when

### Console + network — captured *before* you open the panel

`support-capture.ts` runs `install()` at module scope. Because `support-widget.tsx` imports it (`import "@/lib/support-capture"`), the moment the widget mounts on any page it:

- monkey-patches `console.log/info/warn/error/debug` → keeps the **last 50** entries;
- wraps `window.fetch` and `XMLHttpRequest` → keeps the **last 20** requests that **failed** (`status === 0 || status >= 400`). Successful requests are not recorded.

Each entry is truncated to 500 chars and **redacted in the browser** before it can leave: JWT-shaped strings (`eyJ….….…`) become `[REDACTED_JWT]`, and `authorization` / `cookie` / `x-api-key` / `x-auth-token` values in stringified payloads become `[REDACTED]`. The server never sees the raw values.

This is why the panel already knows there were "3 console logs, 1 failed request" the instant you open it — it's a replay of a buffer, not a fresh capture.

### Screenshot — captured when the panel opens

Opening the panel fires `captureViewport()`. It:

1. dynamically imports `html2canvas-pro` (so it's never in the main bundle — only pulled when a tester actually reports something);
2. hides `[data-support-widget]` so the panel isn't in its own screenshot;
3. renders `document.body` at **viewport size only** (not the whole scrollable page), offsetting by `scrollX/scrollY: -scroll` — an `x/y` crop is broken on a scrolled page in html2canvas-pro v2;
4. in `onclone`, injects CSS that snaps every animation/transition to its final frame. Without this, the off-screen clone restarts CSS animations at time 0 and entrance animations (`.rise`, `.pop-in`) capture as **blank** — that's why the homepage hero used to come out empty;
5. encodes to JPEG @ 0.85.

Two forced choices worth knowing: it must be `html2canvas-**pro**` because Tailwind 4's palette uses `oklch()` colours that classic html2canvas can't parse; and the whole thing is best-effort — if capture throws you get a toast and can still file the bug with no image.

### Annotation

One highlight box, drawn on an SVG overlay on top of the screenshot. Draw to create, drag the body to move, drag a corner handle to resize, optional text label. On submit, `bakeAnnotations()` paints the rectangle + label pill **into the JPEG** on a canvas, so the stored image is self-contained. The raw `{x,y,w,h,label}` also goes to Postgres (`annotations` jsonb) for anyone who wants the un-baked version.

---

## 3. Submit path

The panel POSTs `multipart/form-data` to `/api/support/ticket`:

| Field | Contents |
| --- | --- |
| `message` | "What is wrong?" (required) |
| `expected` | "What should it do instead?" (optional) |
| `screenshot` | the annotation-baked JPEG blob |
| `annotations` | `[{x,y,w,h,label}]` |
| `console_logs` / `network_errors` | the buffers, only if the reporter left the checkboxes ticked |
| `client_metadata` | browser, OS, user agent, screen + viewport size, `url` (pathname+search), `fullUrl` (with origin) |

The submit is **optimistic**: the panel closes, fires confetti, and toasts "Bug reported" immediately; the POST runs in the background and only surfaces a toast if it actually fails.

Server side, `createSupportTicket()` runs four steps in order — and steps 2–4 are all best-effort, so a bug **always** lands in Postgres even if Storage or Sheets is down or unconfigured:

1. **Insert** into `support_tickets` (`status='open'`, `is_issue=true`, `ai_fixed=false`, ref `TICKET-<base36 ts>-<rand>`).
2. **Upload the screenshot** → `support-storage.ts` normalises it with `sharp` (max width 1600, JPEG q80, mozjpeg) and puts it at `avatars/support/<ticketRef>.jpg` in the **public** Supabase bucket. Returns `null` on any failure.
3. **Append a red row to the Google Sheet** → returns the 1-based row number.
4. **Backfill** `screenshot_url` + `sheet_row` onto the ticket row.

`sheet_row` is the join key: it's how a later "mark fixed" knows which sheet row to recolour.

---

## 4. The Google Sheets connection

### Auth

A Google Cloud **service account**, shared on the spreadsheet. Env (`.env.example` lines 81–86):

```
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=   # \n escapes ok
GOOGLE_SHEETS_TAB=Bugs                # optional
```

One non-obvious line does all the work:

```ts
auth.useJWTAccessWithScope = false;   // support-sheets.ts:85
```

With scopes set, google-auth-library defaults to sending a **self-signed JWT**, which the Sheets API rejects with `401 — Expected OAuth 2 access token`. Forcing this false makes it exchange for a real OAuth2 token. Both CLI scripts repeat the same line.

If any of the three vars is missing, `isSheetsConfigured()` is false and **every sheet call silently no-ops** — bugs keep saving to Postgres, they just don't show on the board.

### Columns

| Col | Header | Written by |
| --- | --- | --- |
| A | URL | `=HYPERLINK(fullUrl, fullUrl)` — clickable, full origin |
| B | Logged in as | reporter's `profiles.role` |
| C | What is wrong | `message` |
| D | What it should be | `expected_behavior` |
| E | Is issue | checkbox, `TRUE` on report |
| F | AI fixed | checkbox, `FALSE` on report |
| G | Status | `open` |
| H | Screenshot | `=HYPERLINK("<APP_BASE>/api/support/ticket/<ref>/screenshot","screenshot")` |
| I | Date added | `YYYY-MM-DD HH:MM` |
| J | Ticket | `ticket_ref` |
| K | AI Comment | empty on report; the AI fixer's change summary |

Column H deliberately points at **our** app, not the raw Supabase object URL, so the sheet stays pinned to a stable `letsclick.app` link. That route 302s to the stored image, and renders a readable HTML card (not JSON) when there's no screenshot — because a human opens it in a browser.

### Colour = conditional formatting, not imperative painting

We **never** recolour cells from code. Four `CUSTOM_FORMULA` rules are installed once on the sheet (first match wins, so order is priority):

| Priority | Formula | Colour | Meaning |
| --- | --- | --- | --- |
| 0 | `=$G2="fixed"` | 🟢 green | human confirmed fixed |
| 1 | `=$F2=TRUE` | 🟠 amber | AI says fixed — awaiting human verify |
| 2 | `=$E2=FALSE` | ⚪ gray | triaged: not a real issue |
| 3 | `=$A2<>""` | 🔴 red | open — catch-all for any non-empty row |

That means colours stay correct no matter who edits — our API, the AI script, or a human typing directly into Sheets. Code only ever writes **values**; the sheet derives the colour.

`ensureSheet()` self-heals on every call: it creates the tab if missing, writes the header row if row 1 is empty, and rebuilds the rules if they're missing, mis-anchored, or too narrow (e.g. after column K was added). The grid is grown to 2000 rows first, because Google **clamps an unbounded conditional-format range to the grid's row count at creation time**.

### Why we don't use `spreadsheets.values.append`

`appendBugRow()` reads column A, computes `nextRow = len(A) + 1`, grows the grid if needed, and writes with `values.update` to an explicit `A{n}:K{n}` range. Sheets' append-mode table detection gets confused by the checkbox data-validation in E/F and scatters rows to the bottom of the grid. Column A (the URL) is never a checkbox, so counting it is reliable.

---

## 5. The lifecycle

```
reporter files bug
        │
        ▼
   🔴 RED  status=open, ai_fixed=false, is_issue=true
        │
        ├── AI fixer: fixes code, runs mark-ai-fixed.mjs ──▶ 🟠 AMBER  ai_fixed=true
        │                                                        │
        │                        human tests it ◀────────────────┤
        │                            │                           │
        │            ┌───────────────┴──────────────┐            │
        │            ▼                              ▼            │
        │      "yep, fixed"                  "still broken"      │
        │      Status=fixed                  un-tick AI fixed    │
        │            │                       + note              │
        │            ▼                              │            │
        │      🟢 GREEN  done                       └────────────┘ back to 🔴 RED
        │
        └── triager: un-tick "Is issue" ──▶ ⚪ GRAY  not a bug, ignored
```

Every transition can be driven from **either** end — the in-app widget or the sheet itself — and both stay in sync:

| Action | Where | What happens |
| --- | --- | --- |
| Tick a bug off the panel's "Bugs on this page" checklist | widget → `PATCH {status:"fixed"}` → `markTicketFixed()` | Postgres `status='fixed'`, `fixed_at`, `fixed_by_profile_id`; sheet col G → `"fixed"` → 🟢 |
| "Not fixed →" + a note | widget → `PATCH {status:"open", note}` → `reopenTicketForRefix()` | Postgres `ai_fixed=false`, note appended to `message` with a `[Still not fixed · <ts>]` stamp; sheet F→FALSE, G→`open`, C→updated text → 🔴 |
| "Edit" a bug (text and/or status dropdown) | widget → `PATCH {status:"edit", …}` → `editTicket()` | Rewrites C/D, and if a status was picked, E/F/G too (`BUG_STATE` maps the 4 reporter-facing states onto the column triple) |
| Human edits the sheet directly | Sheets | Colour updates via the rules. **Postgres does not follow** — the sheet is the working board, Postgres is the record. See gotchas. |

The panel's second tab is the per-page checklist: `GET /api/support/ticket?url=<pathname+search>` → `listOpenBugsForUrl()` → `where url = $1 and status='open' and is_issue = true`. Amber (AI-fixed) bugs still show, badged **"AI says fixed — verify"**.

---

## 6. The AI fixer loop

This is the workflow CLAUDE.md tells Claude Code to run when you say "work the bug board":

1. `node scripts/read-bugs.mjs` — dumps every row as JSON (`rowNum` + `cells`, including the resolved HYPERLINK URLs). Work only the 🔴 rows: `Status = open` **and** `AI fixed = FALSE`. Skip amber (already claimed), green (done), gray (not a bug).
2. Fix the code. Column A maps to a file via the Page URI map in CLAUDE.md; C/D say what's wrong and what it should do; H is the screenshot.
3. `node scripts/mark-ai-fixed.mjs <row> "Fixed X by doing Y"` — one command, two writes: ticks col F + writes col K on the **sheet**, and sets `ai_fixed=true` + `ai_comment` in **Postgres** (matched via the `ticket_ref` in col J). Bare row numbers (`21 22 23`) tick several at once with no comment.
4. **Never** set `Status = fixed` from the AI side. Green is the human tester's signature.

Both scripts auto-load `.env.local` and need the three `GOOGLE_*` vars; `mark-ai-fixed.mjs` additionally needs `DATABASE_URL` for the Postgres half (it skips it silently if unset). `scripts/test-sheets.mjs` appends three demo rows if you just want to prove the connection works.

---

## 7. Gotchas

- **The widget only renders for logged-in users**, and the API 401s anonymous requests. There is no guest bug report.
- **Sheet edits don't flow back to Postgres.** Writes are one-way (app → sheet) except through the API. If a human types `fixed` into col G by hand, the row goes green but `support_tickets.status` stays `open`, so the bug keeps appearing on the in-app checklist. Tick it off in the widget instead, and the sheet follows.
- **`sheet_row` is a row *number*.** Inserting or deleting rows in the middle of the sheet by hand shifts every row below it and silently de-syncs the mapping. Append and archive; don't insert.
- **Everything is best-effort except the Postgres insert.** Missing `GOOGLE_*` → no board rows. Missing `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` → no screenshots. Neither blocks a report, and neither throws into the request; they just `console.warn`.
- **Screenshots are world-readable.** They live in the public `avatars` bucket. A screenshot of a page containing PII is publicly fetchable by anyone with the URL. Fine pre-launch; revisit before real users exist.
- The `status` CHECK constraint in migration 037 only allows `('open','fixed')` — the `ai_fixed` / `not_issue` states are represented by the **boolean columns**, not by new status values.
