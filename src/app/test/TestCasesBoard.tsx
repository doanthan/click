"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const STATUSES = ["todo", "passing", "failing", "blocked"] as const;
type Status = (typeof STATUSES)[number];

type Comment = {
  id: string;
  author: string | null;
  body: string;
  createdAt: string;
};

type TestCase = {
  id: string;
  title: string;
  description: string;
  status: Status;
  author: string | null;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
};

const NAME_KEY = "click-test-author-v1";

const statusBadge: Record<Status, string> = {
  todo: "bg-[color:var(--cream)] text-[color:var(--ink)]",
  passing: "bg-[color:var(--peach)] text-[color:var(--surface-deep)]",
  failing: "bg-[color:var(--rose)] text-[color:var(--surface-deep)]",
  blocked: "bg-[color:var(--ink)] text-[color:var(--champagne)]",
};

const statusLabel: Record<Status, string> = {
  todo: "To do",
  passing: "Passing",
  failing: "Failing",
  blocked: "Blocked",
};

function relativeTime(iso: string) {
  try {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  } catch {
    return "";
  }
}

async function readError(res: Response, fallback: string) {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export default function TestCasesBoard() {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newStatus, setNewStatus] = useState<Status>("todo");
  const [creating, setCreating] = useState(false);

  // IDs with an in-flight mutation, so we can disable just that row's controls.
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const setRowBusy = useCallback((id: string, value: boolean) => {
    setBusy((prev) => ({ ...prev, [id]: value }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/test/cases", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Could not load test cases.");
        setCases([]);
      } else {
        setCases(data.cases as TestCase[]);
      }
    } catch {
      setError("Could not reach the server.");
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    try {
      const saved = window.localStorage.getItem(NAME_KEY);
      if (saved) setAuthor(saved);
    } catch {
      // ignore
    }
  }, [load]);

  // Persist the author name so people don't retype it on every action.
  const persistAuthor = useCallback((value: string) => {
    try {
      if (value.trim()) window.localStorage.setItem(NAME_KEY, value.trim());
    } catch {
      // ignore
    }
  }, []);

  const handleCreate = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!title.trim()) {
        toast.error("Give the test case a title.");
        return;
      }
      setCreating(true);
      persistAuthor(author);
      try {
        const res = await fetch("/api/test/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, status: newStatus, author }),
        });
        if (!res.ok) {
          toast.error(await readError(res, "Could not add the test case."));
          return;
        }
        const data = await res.json();
        setCases((prev) => [data.case as TestCase, ...prev]);
        setTitle("");
        setDescription("");
        setNewStatus("todo");
        toast.success("Test case added.");
      } catch {
        toast.error("Could not reach the server.");
      } finally {
        setCreating(false);
      }
    },
    [title, description, newStatus, author, persistAuthor],
  );

  const handleStatus = useCallback(
    async (id: string, status: Status) => {
      setRowBusy(id, true);
      setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
      try {
        const res = await fetch(`/api/test/cases/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          toast.error(await readError(res, "Could not update status."));
          load();
        }
      } catch {
        toast.error("Could not reach the server.");
        load();
      } finally {
        setRowBusy(id, false);
      }
    },
    [load, setRowBusy],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm("Remove this test case and all its comments?")) return;
      setRowBusy(id, true);
      try {
        const res = await fetch(`/api/test/cases/${id}`, { method: "DELETE" });
        if (!res.ok) {
          toast.error(await readError(res, "Could not remove the test case."));
          return;
        }
        setCases((prev) => prev.filter((c) => c.id !== id));
        toast.success("Test case removed.");
      } catch {
        toast.error("Could not reach the server.");
      } finally {
        setRowBusy(id, false);
      }
    },
    [setRowBusy],
  );

  const handleAddComment = useCallback(
    async (id: string, body: string) => {
      persistAuthor(author);
      const res = await fetch(`/api/test/cases/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, author }),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Could not post the comment."));
        return false;
      }
      const data = await res.json();
      setCases((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, comments: [...c.comments, data.comment as Comment] } : c,
        ),
      );
      return true;
    },
    [author, persistAuthor],
  );

  const handleDeleteComment = useCallback(async (caseId: string, commentId: string) => {
    const res = await fetch(`/api/test/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(await readError(res, "Could not delete the comment."));
      return;
    }
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? { ...c, comments: c.comments.filter((cm) => cm.id !== commentId) }
          : c,
      ),
    );
  }, []);

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[color:var(--line)] pb-4">
        <div>
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Editable in Supabase
          </p>
          <h2 className="mt-1 font-display text-4xl font-light leading-[0.96] tracking-tight">
            Test cases
          </h2>
        </div>
        <p className="max-w-md text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Anyone can add a case, flip its status, drop a comment, or remove it.
          Every change is saved straight to the <code className="font-mono text-[0.8em]">test_cases</code> table.
        </p>
      </div>

      {/* Shared name — reused for new cases and comments. */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
          Your name
        </label>
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          onBlur={() => persistAuthor(author)}
          placeholder="optional — shown on what you post"
          className="min-w-[14rem] flex-1 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] outline-none focus:border-[color:var(--rose)]"
        />
      </div>

      {/* New test case form */}
      <form
        onSubmit={handleCreate}
        className="mt-4 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Test case title — e.g. “Booking a paid event charges the card”"
            className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2.5 text-sm font-bold text-[color:var(--ink)] outline-none focus:border-[color:var(--rose)]"
          />
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as Status)}
            className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2.5 text-sm font-bold text-[color:var(--ink)] outline-none focus:border-[color:var(--rose)]"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Steps, expected result, or notes (optional)"
          rows={2}
          className="mt-3 w-full resize-y rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2.5 text-sm font-medium leading-6 text-[color:var(--ink)] outline-none focus:border-[color:var(--rose)]"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[color:var(--surface-deep)] transition hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)] disabled:opacity-50"
          >
            {creating ? "Adding…" : "Add test case"}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="mt-6 grid gap-4">
        {loading ? (
          <p className="text-sm font-medium text-[color:var(--mauve)]">Loading test cases…</p>
        ) : error ? (
          <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 text-sm font-medium text-[color:var(--mauve)]">
            {error}{" "}
            <button onClick={load} className="font-bold text-[color:var(--rose)] underline">
              Retry
            </button>
          </div>
        ) : cases.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-[color:var(--line-soft)] p-6 text-center text-sm font-medium text-[color:var(--mauve)]">
            No test cases yet — add the first one above.
          </p>
        ) : (
          cases.map((testCase) => (
            <TestCaseCard
              key={testCase.id}
              testCase={testCase}
              busy={Boolean(busy[testCase.id])}
              onStatus={handleStatus}
              onDelete={handleDelete}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
            />
          ))
        )}
      </div>
    </section>
  );
}

function TestCaseCard({
  testCase,
  busy,
  onStatus,
  onDelete,
  onAddComment,
  onDeleteComment,
}: {
  testCase: TestCase;
  busy: boolean;
  onStatus: (id: string, status: Status) => void;
  onDelete: (id: string) => void;
  onAddComment: (id: string, body: string) => Promise<boolean>;
  onDeleteComment: (caseId: string, commentId: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submitComment = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!comment.trim()) return;
      setPosting(true);
      const ok = await onAddComment(testCase.id, comment.trim());
      setPosting(false);
      if (ok) {
        setComment("");
        setShowComments(true);
        inputRef.current?.focus();
      }
    },
    [comment, onAddComment, testCase.id],
  );

  return (
    <article className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-light leading-tight text-[color:var(--ink)]">
            {testCase.title}
          </h3>
          {testCase.description ? (
            <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6 text-[color:var(--mauve)]">
              {testCase.description}
            </p>
          ) : null}
          <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[color:var(--mauve)]/70">
            {testCase.author ? `${testCase.author} · ` : ""}added {relativeTime(testCase.createdAt)}
          </p>
        </div>
        <button
          onClick={() => onDelete(testCase.id)}
          disabled={busy}
          aria-label="Remove test case"
          className="shrink-0 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[color:var(--ink)] transition hover:border-[color:var(--rose)] hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)] disabled:opacity-50"
        >
          Remove
        </button>
      </div>

      {/* Status switcher */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => {
          const active = testCase.status === s;
          return (
            <button
              key={s}
              onClick={() => !active && onStatus(testCase.id, s)}
              disabled={busy}
              className={`rounded-full border-2 px-3 py-1 text-[0.66rem] font-bold uppercase tracking-[0.12em] transition disabled:opacity-50 ${
                active
                  ? `${statusBadge[s]} border-[color:var(--line)]`
                  : "border-[color:var(--line-soft)] bg-transparent text-[color:var(--mauve)] hover:border-[color:var(--line)]"
              }`}
            >
              {statusLabel[s]}
            </button>
          );
        })}
      </div>

      {/* Comments */}
      <div className="mt-4 border-t-2 border-[color:var(--line-soft)] pt-3">
        <button
          onClick={() => setShowComments((v) => !v)}
          className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)] hover:text-[color:var(--ink)]"
        >
          {showComments ? "Hide" : "Show"} comments ({testCase.comments.length})
        </button>

        {showComments && testCase.comments.length > 0 ? (
          <ul className="mt-3 grid gap-2">
            {testCase.comments.map((c) => (
              <li
                key={c.id}
                className="group flex items-start justify-between gap-3 rounded-2xl border-2 border-[color:var(--line-soft)] bg-[color:var(--cream)] px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-[color:var(--ink)]">
                    {c.body}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[color:var(--mauve)]/70">
                    {c.author ? `${c.author} · ` : ""}{relativeTime(c.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => onDeleteComment(testCase.id, c.id)}
                  aria-label="Delete comment"
                  className="shrink-0 text-[color:var(--mauve)]/50 opacity-0 transition hover:text-[color:var(--rose)] group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <form onSubmit={submitComment} className="mt-3 flex gap-2">
          <input
            ref={inputRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] outline-none focus:border-[color:var(--rose)]"
          />
          <button
            type="submit"
            disabled={posting || !comment.trim()}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[color:var(--champagne)] transition hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)] disabled:opacity-50"
          >
            {posting ? "…" : "Post"}
          </button>
        </form>
      </div>
    </article>
  );
}
