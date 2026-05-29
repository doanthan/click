// "Open" target for items on /notifications. Renders the email_events row
// that was logged when the notification fired, inside a sandboxed iframe.
// Also marks the notification as read on view, and keeps the original
// notification.action_url available as a secondary "Take action" button.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  getNotificationEmailForSession,
  markNotificationRead,
} from "@/lib/event-repository";

export const metadata = {
  title: "Notification email | Click",
  robots: { index: false, follow: false },
};

// HTML blob comes from email_events — keep the page dynamic so a recent
// notification reflects the latest rendered email without a stale cache.
export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

type PageProps = {
  params: Promise<{ id: string }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NotificationEmailPage({ params }: PageProps) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/notifications/${id}/email`);
  }

  const view = await getNotificationEmailForSession(session, id);
  if (!view) notFound();

  // Treat opening the email as reading the notification — matches what users
  // expect from any inbox-style UI and clears the unread badge on /notifications.
  if (!view.notification.readAt) {
    await markNotificationRead(session, id);
  }

  const { notification, email } = view;
  const sentAt = email ? new Date(email.createdAt) : new Date(notification.createdAt);

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-3xl">
        <Link
          href="/notifications"
          className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)] hover:text-[color:var(--ink)]"
        >
          ← Back to notifications
        </Link>

        <header className="mt-6">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            {email ? "Email" : "Notification"}
          </span>
          <h1 className="mt-6 font-display text-4xl font-light leading-[0.98] tracking-tight sm:text-5xl">
            {email?.subject ?? notification.title}
          </h1>
          <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-[6rem_1fr]">
            <dt className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              To
            </dt>
            <dd className="font-mono text-[0.85rem] text-[color:var(--ink)]">
              {email?.toEmail ?? session.user.email ?? "—"}
            </dd>
            <dt className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Sent
            </dt>
            <dd className="font-semibold text-[color:var(--ink)]">
              {dateFormatter.format(sentAt)}
            </dd>
            {email ? (
              <>
                <dt className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  Template
                </dt>
                <dd className="font-mono text-[0.85rem] text-[color:var(--ink)]">
                  {email.template}
                </dd>
              </>
            ) : null}
          </dl>

          {notification.actionUrl ? (
            <div className="mt-6">
              <Link
                href={notification.actionUrl}
                className="inline-flex items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
              >
                Take action
              </Link>
            </div>
          ) : null}
        </header>

        <div className="mt-8 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 hard-shadow-sm sm:p-6">
          {email ? (
            <div className="flex justify-center">
              <iframe
                title={`${email.template} preview`}
                srcDoc={email.html}
                // Mirrors /email's preview iframe: `allow-same-origin` for
                // Google Fonts, no `allow-scripts` so email-side JS can't run.
                sandbox="allow-same-origin"
                style={{
                  width: 600,
                  maxWidth: "100%",
                  height: 900,
                  border: "1px solid var(--line)",
                  background: "#FFFCF9",
                  borderRadius: 12,
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-display text-lg font-light leading-snug text-[color:var(--ink)]">
                {notification.title}
              </p>
              <p className="text-sm font-medium leading-6 text-[color:var(--mauve)]">
                {notification.body}
              </p>
              <p className="rounded-xl border border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                No rendered email is on file for this notification — the
                trigger that created it hasn&rsquo;t been wired to{" "}
                <code className="font-mono">logEmailEvent</code> yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
