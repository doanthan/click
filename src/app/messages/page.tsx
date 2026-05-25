import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Pill } from "@/components/click-ui";
import {
  getConversationDetail,
  getConversationsForSession,
  getMutualClicksForSession,
} from "@/lib/event-repository";
import { sendMessageAction, startConversationAction } from "./actions";

export const metadata = {
  title: "Messages | Click",
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

type MessagesPageProps = {
  searchParams?: Promise<{ id?: string }>;
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/messages");
  }

  const params = await searchParams;
  const activeId = typeof params?.id === "string" ? params.id : null;

  const [conversations, mutuals, activeConversation] = await Promise.all([
    getConversationsForSession(session),
    getMutualClicksForSession(session),
    activeId ? getConversationDetail(session, activeId) : Promise.resolve(null),
  ]);

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Messages
        </span>
        <h1 className="mt-6 font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          1-to-1 chats.
        </h1>
        <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
          Click is private by default — DMs only open up to people you’ve had a
          mutual Click with. Keep it warm, keep it real.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_2fr]">
          <aside className="space-y-5">
            <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                  Conversations
                </span>
                <Pill tone="peach">{conversations.length}</Pill>
              </div>
              {conversations.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {conversations.map((c) => {
                    const active = c.id === activeId;
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/messages?id=${c.id}`}
                          className={`block rounded-2xl border-2 border-[color:var(--line)] p-3 hard-shadow-sm ${
                            active
                              ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                              : "bg-[color:var(--champagne)] hover:bg-[color:var(--peach)]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display text-lg font-light leading-tight">
                              {c.otherDisplayName}
                            </span>
                            {c.unread ? (
                              <span className="inline-flex items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-[color:var(--on-deep)]">
                                New
                              </span>
                            ) : null}
                          </div>
                          {c.preview ? (
                            <p className="mt-1 line-clamp-1 text-sm font-medium opacity-90">
                              {c.preview}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs font-medium opacity-70">
                              No messages yet — say hi.
                            </p>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  Nothing yet. Mutual Clicks below can start a new thread.
                </p>
              )}
            </div>

            {mutuals.length > 0 ? (
              <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--ink)] p-5 text-[color:var(--on-deep)] hard-shadow-sm">
                <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--peach)]">
                  Mutual Clicks · start a thread
                </span>
                <ul className="mt-4 space-y-2">
                  {mutuals.map((m) => (
                    <li key={m.otherProfileId}>
                      <form action={startConversationAction}>
                        <input
                          type="hidden"
                          name="other_profile_id"
                          value={m.otherProfileId}
                        />
                        <button
                          type="submit"
                          className="w-full rounded-2xl border-2 border-[color:var(--peach)] bg-[color:var(--surface-deep)] px-3 py-2 text-left text-sm font-bold text-[color:var(--on-deep)] hover:bg-[color:var(--peach)] hover:text-[color:var(--surface-deep)]"
                        >
                          {m.otherDisplayName}
                          <span className="ml-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] opacity-70">
                            ↗ open chat
                          </span>
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>

          <div className="lg:hidden rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            Chat works best on a larger screen. We’ll wire mobile-optimised
            threading in a follow-up.
          </div>

          <section className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
            {activeConversation ? (
              <div className="flex flex-col" style={{ minHeight: "32rem" }}>
                <header className="flex items-center justify-between gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-3">
                  <div>
                    <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                      Chatting with
                    </p>
                    <Link
                      href={`/profile/${activeConversation.otherProfileId}`}
                      className="font-display text-2xl font-light leading-tight hover:text-[color:var(--rose)]"
                    >
                      {activeConversation.otherDisplayName}
                    </Link>
                  </div>
                  <Link
                    href="/messages"
                    className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hover:bg-[color:var(--cream)]"
                  >
                    All chats
                  </Link>
                </header>

                <ol className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
                  {activeConversation.messages.length === 0 ? (
                    <li className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                      No messages yet. Say hi — keep it short, ask about an
                      event you both might attend.
                    </li>
                  ) : (
                    activeConversation.messages.map((m) => (
                      <li
                        key={m.id}
                        className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl border-2 border-[color:var(--line)] px-4 py-2 hard-shadow-sm ${
                            m.isMine
                              ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                              : "bg-[color:var(--champagne)] text-[color:var(--ink)]"
                          }`}
                        >
                          <p className="text-sm font-medium leading-6 whitespace-pre-wrap break-words">
                            {m.body}
                          </p>
                          <p className="mt-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] opacity-70">
                            {dateFormatter.format(new Date(m.createdAt))}
                          </p>
                        </div>
                      </li>
                    ))
                  )}
                </ol>

                <form
                  action={sendMessageAction}
                  className="flex items-center gap-3 border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-4"
                >
                  <input
                    type="hidden"
                    name="conversation_id"
                    value={activeConversation.id}
                  />
                  <input
                    name="body"
                    required
                    maxLength={2000}
                    placeholder="Type a message…"
                    className="flex-1 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2.5 text-sm font-semibold text-[color:var(--ink)] outline-none focus:bg-[color:var(--champagne)]"
                  />
                  <button
                    type="submit"
                    className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
                  >
                    Send
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex h-full min-h-[24rem] items-center justify-center p-8 text-center">
                <div>
                  <p className="font-display text-3xl font-light leading-tight">
                    Pick a conversation to start.
                  </p>
                  <p className="mt-3 max-w-md text-sm font-medium leading-6 text-[color:var(--mauve)]">
                    Or open one from a mutual Click in the sidebar. We don’t
                    surface random users here — DMs need consent on both sides.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
