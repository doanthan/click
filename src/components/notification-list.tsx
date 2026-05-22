"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { NotificationRow } from "@/lib/event-repository";

function formatRelative(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
  });
}

export function NotificationList({ initial }: { initial: NotificationRow[] }) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const unread = items.filter((item) => !item.read).map((item) => item.id);
    if (unread.length === 0) return;

    const handle = window.setTimeout(() => {
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unread }),
      })
        .then((response) => {
          if (!response.ok) return;
          setItems((current) =>
            current.map((item) =>
              unread.includes(item.id) ? { ...item, read: true } : item,
            ),
          );
          startTransition(() => router.refresh());
        })
        .catch(() => {
          // silent — toast would be noise on auto-read
        });
    }, 1500);

    return () => window.clearTimeout(handle);
  }, [items, router]);

  async function markAllRead() {
    const unread = items.filter((item) => !item.read).map((item) => item.id);
    if (unread.length === 0) return;
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unread }),
    });
    if (!response.ok) {
      toast.error("Couldn't mark as read.");
      return;
    }
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    toast.success("All marked as read.");
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-8 text-center">
        <p className="font-display text-3xl font-light leading-tight">
          Inbox zero.
        </p>
        <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
          We&apos;ll ping you when someone Clicks back or an event you&apos;ve saved is starting soon.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={markAllRead}
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
        >
          Mark all read
        </button>
      </div>
      <ul className="space-y-3">
        {items.map((item) => {
          const inner = (
            <article
              className={
                item.read
                  ? "flex items-start gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5"
                  : "flex items-start gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-5 hard-shadow-sm"
              }
            >
              <span
                aria-hidden
                className={
                  item.read
                    ? "mt-1 size-3 shrink-0 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)]"
                    : "mt-1 size-3 shrink-0 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)]"
                }
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[color:var(--ink)]">{item.title}</p>
                <p className="mt-1 text-sm font-medium text-[color:var(--mauve)]">{item.body}</p>
                <p className="mt-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  {item.channel} · {formatRelative(item.createdAt)}
                </p>
              </div>
            </article>
          );

          return (
            <li key={item.id}>
              {item.actionUrl ? (
                <Link href={item.actionUrl} className="block">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
