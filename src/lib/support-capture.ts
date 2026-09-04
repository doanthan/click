/**
 * Always-on client-side capture for the bug reporter.
 *
 * Importing this module (once, from the client SupportWidget) starts capturing
 * immediately: it monkey-patches console.* and wraps fetch + XHR so that when a
 * tester opens the panel we already have the recent console output and any
 * failed network requests for the current page.
 *
 * Everything is bounded (50 console / 20 network) and secrets are redacted in
 * the browser before they ever reach the API. Safe to import on the server -
 * the install is a no-op when `window` is undefined.
 */

export type ConsoleEntry = {
  level: "log" | "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
};

export type NetworkEntry = {
  method: string;
  url: string;
  status: number;
  duration: number; // ms
  timestamp: string;
  body: string;
};

/**
 * A tester-facing explanation of what happened in the browser.
 *
 * Unlike the support ticket buffers above, this is a cross-page session
 * timeline. It deliberately records outcomes and control labels, never form
 * values, cookies, request headers, or response bodies. The bounded timeline
 * lives in sessionStorage so it survives persona switches and full redirects
 * in the current tab, then disappears when the tab is closed.
 */
export type QaActivityKind =
  | "navigation"
  | "interaction"
  | "network"
  | "console"
  | "runtime"
  | "checkpoint";

export type QaActivityLevel = "info" | "success" | "warning" | "error";

export type QaActivityEntry = {
  id: string;
  kind: QaActivityKind;
  level: QaActivityLevel;
  title: string;
  detail: string;
  explanation: string;
  timestamp: string;
  path: string;
  actorEmail: string | null;
  actorLabel: string | null;
  status?: number;
  duration?: number;
};

export type QaRecorderState = {
  entries: QaActivityEntry[];
  enabled: boolean;
  startedAt: string;
};

const MAX_CONSOLE = 50;
const MAX_NETWORK = 20;
const MAX_QA_ACTIVITY = 250;
const TRUNCATE = 500;
const QA_STORAGE_KEY = "click-qa-activity-v1";

const consoleBuffer: ConsoleEntry[] = [];
const networkBuffer: NetworkEntry[] = [];
const qaActivityBuffer: QaActivityEntry[] = [];
const qaListeners = new Set<() => void>();

let qaHydrated = false;
let qaCaptureActive = false;
let qaRecordingEnabled = true;
let qaStartedAt = "";
let qaActorEmail: string | null = null;
let qaActorLabel: string | null = null;

const REDACT_KEYS = ["authorization", "cookie", "x-api-key", "x-auth-token"];
// JWT-ish: three base64url segments, the first starting `eyJ`.
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function redact(value: string): string {
  if (!value) return value;
  let out = value.replace(JWT_RE, "[REDACTED_JWT]");
  for (const key of REDACT_KEYS) {
    // Strip `key: <value>` / `key=<value>` style leaks in stringified payloads.
    const re = new RegExp(`(${key}\\s*[:=]\\s*)([^\\s,;"'}]+)`, "gi");
    out = out.replace(re, `$1[REDACTED]`);
  }
  return out;
}

const SENSITIVE_QUERY_KEYS = /(?:key|token|secret|password|code|auth|signature|session)/i;

/** Keep a useful route while removing credentials that sometimes travel in query strings. */
function redactUrl(value: string): string {
  if (!value) return value;
  try {
    const base = typeof window === "undefined" ? "https://click.invalid" : window.location.origin;
    const url = new URL(value, base);
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.test(key)) url.searchParams.set(key, "[REDACTED]");
    }
    if (typeof window !== "undefined" && url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return truncate(redact(value), 240);
  }
}

function truncate(value: string, max = TRUNCATE): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}… (+${value.length - max} chars)`;
}

function stringifyArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function nowIso(): string {
  // Wrapped so the no-op server import never touches Date at module scope.
  return new Date().toISOString();
}

function currentPath(): string {
  if (typeof window === "undefined") return "";
  return redactUrl(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}

function qaId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hydrateQaActivity() {
  if (qaHydrated || typeof window === "undefined") return;
  qaHydrated = true;
  qaStartedAt = nowIso();
  try {
    const raw = window.sessionStorage.getItem(QA_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<QaRecorderState>;
    if (Array.isArray(saved.entries)) {
      qaActivityBuffer.push(
        ...saved.entries
          .filter(
            (entry): entry is QaActivityEntry =>
              !!entry &&
              typeof entry.id === "string" &&
              typeof entry.title === "string" &&
              typeof entry.timestamp === "string",
          )
          .slice(-MAX_QA_ACTIVITY),
      );
    }
    if (typeof saved.enabled === "boolean") qaRecordingEnabled = saved.enabled;
    if (typeof saved.startedAt === "string" && saved.startedAt) qaStartedAt = saved.startedAt;
  } catch {
    // A corrupt or blocked sessionStorage must never affect the product.
  }
}

function persistQaActivity() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      QA_STORAGE_KEY,
      JSON.stringify({
        entries: qaActivityBuffer,
        enabled: qaRecordingEnabled,
        startedAt: qaStartedAt || nowIso(),
      } satisfies QaRecorderState),
    );
  } catch {
    // Browsers may disable storage. The in-memory recorder still works.
  }
}

function notifyQaListeners() {
  for (const listener of qaListeners) listener();
}

function addQaActivity(
  input: Omit<QaActivityEntry, "id" | "timestamp" | "path" | "actorEmail" | "actorLabel"> & {
    path?: string;
    timestamp?: string;
  },
  force = false,
) {
  if (typeof window === "undefined") return;
  // SupportWidget imports this module for every visitor. The richer persistent
  // QA timeline is activated only by the gated testing drawer.
  if (!qaCaptureActive && !force) return;
  hydrateQaActivity();
  if (!qaRecordingEnabled && !force) return;

  qaActivityBuffer.push({
    ...input,
    id: qaId(),
    timestamp: input.timestamp ?? nowIso(),
    path: redactUrl(input.path ?? currentPath()),
    actorEmail: qaActorEmail,
    actorLabel: qaActorLabel,
    detail: truncate(redact(input.detail), 700),
    explanation: truncate(redact(input.explanation), 700),
  });
  if (qaActivityBuffer.length > MAX_QA_ACTIVITY) qaActivityBuffer.shift();
  persistQaActivity();
  notifyQaListeners();
}

function explainHttpStatus(status: number): string {
  if (status === 0) {
    return "The browser did not receive an HTTP response. The device may be offline, the request may have been cancelled, or the server could not be reached.";
  }
  if (status === 400 || status === 422) {
    return "The server rejected the request as invalid. Check required fields and the validation message shown near the control.";
  }
  if (status === 401) {
    return "The request did not have a valid session. The login may have expired or the action requires signing in.";
  }
  if (status === 403) {
    return "The server understood the request but refused it. This account may not have the role or permission required for the action.";
  }
  if (status === 404) {
    return "The requested route or record was not available. It may have moved, been deleted, or be intentionally hidden from this account.";
  }
  if (status === 409) {
    return "The action conflicted with the current saved state. Refresh the page and check whether another action already changed this record.";
  }
  if (status === 429) {
    return "The request was rate-limited because too many attempts happened in a short period. Wait briefly before trying again.";
  }
  if (status >= 500) {
    return "The request reached the server, but the server could not complete it. This is usually an application, database, or connected-service error.";
  }
  return "The request completed with a non-success response. Open the event to compare the status with the message shown on the page.";
}

function networkActivity(input: {
  method: string;
  url: string;
  status: number;
  duration: number;
}) {
  const safeUrl = redactUrl(input.url);
  const failed = input.status === 0 || input.status >= 400;
  addQaActivity({
    kind: "network",
    level: failed ? "error" : "success",
    title: failed
      ? `${input.method} request failed (${input.status || "network"})`
      : `${input.method} request completed`,
    detail: `${safeUrl} in ${input.duration} ms`,
    explanation: failed
      ? explainHttpStatus(input.status)
      : "The server accepted the change. A later screen update or follow-up request may show its visible result.",
    status: input.status,
    duration: input.duration,
  });
}

function pushConsole(entry: ConsoleEntry) {
  consoleBuffer.push(entry);
  if (consoleBuffer.length > MAX_CONSOLE) consoleBuffer.shift();
}

function pushNetwork(entry: NetworkEntry) {
  networkBuffer.push(entry);
  if (networkBuffer.length > MAX_NETWORK) networkBuffer.shift();
}

let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // --- console buffer -------------------------------------------------------
  const levels: ConsoleEntry["level"][] = ["log", "info", "warn", "error", "debug"];
  for (const level of levels) {
    const original = console[level]?.bind(console) ?? console.log.bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        const message = truncate(redact(args.map(stringifyArg).join(" ")));
        pushConsole({
          level,
          message,
          timestamp: nowIso(),
        });
        if (level === "warn" || level === "error") {
          addQaActivity({
            kind: "console",
            level: level === "error" ? "error" : "warning",
            title: level === "error" ? "Console error" : "Console warning",
            detail: message,
            explanation:
              level === "error"
                ? "The page or one of its libraries reported an error. This may explain missing content, a stopped action, or a control that did not update."
                : "The page reported a warning. The action may still work, but this is a sign that a fallback or unexpected condition was used.",
          });
        }
      } catch {
        /* never let capture break logging */
      }
      original(...args);
    };
  }

  // --- fetch wrapper --------------------------------------------------------
  const originalFetch = window.fetch?.bind(window);
  if (originalFetch) {
    window.fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const start = performance.now();
      const method = (init?.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
      const url = redactUrl(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      );
      try {
        const res = await originalFetch(input, init);
        const duration = Math.round(performance.now() - start);
        if (res.status === 0 || res.status >= 400) {
          pushNetwork({
            method,
            url,
            status: res.status,
            duration,
            timestamp: nowIso(),
            body: truncate(redact(typeof init?.body === "string" ? init.body : "")),
          });
        }
        // Successful reads are too noisy to help a manual test. Mutations and
        // every failure are the state-changing/outcome events worth explaining.
        if (method !== "GET" && method !== "HEAD" || res.status === 0 || res.status >= 400) {
          networkActivity({ method, url, status: res.status, duration });
        }
        return res;
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        pushNetwork({
          method,
          url,
          status: 0,
          duration,
          timestamp: nowIso(),
          body: truncate(redact(err instanceof Error ? err.message : String(err))),
        });
        networkActivity({ method, url, status: 0, duration });
        throw err;
      }
    };
  }

  // --- XHR wrapper ----------------------------------------------------------
  const XHR = XMLHttpRequest.prototype;
  const originalOpen = XHR.open;
  const originalSend = XHR.send;

  XHR.open = function (this: XMLHttpRequest, method: string, url: string | URL) {
    (this as unknown as Record<string, unknown>).__support = {
      method: (method || "GET").toUpperCase(),
      url: typeof url === "string" ? url : url.href,
    };
    // eslint-disable-next-line prefer-rest-params
    return originalOpen.apply(this, arguments as unknown as Parameters<typeof originalOpen>);
  };

  XHR.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = (this as unknown as Record<string, unknown>).__support as
      | { method: string; url: string }
      | undefined;
    const start = performance.now();
    this.addEventListener("loadend", () => {
      if (!meta) return;
      const duration = Math.round(performance.now() - start);
      if (this.status === 0 || this.status >= 400) {
        pushNetwork({
          method: meta.method,
          url: redactUrl(meta.url),
          status: this.status,
          duration,
          timestamp: nowIso(),
          body: truncate(redact(typeof body === "string" ? body : "")),
        });
      }
      if (meta.method !== "GET" && meta.method !== "HEAD" || this.status === 0 || this.status >= 400) {
        networkActivity({
          method: meta.method,
          url: meta.url,
          status: this.status,
          duration,
        });
      }
    });
    // eslint-disable-next-line prefer-rest-params
    return originalSend.apply(this, arguments as unknown as Parameters<typeof originalSend>);
  };

  // Runtime failures do not always pass through console.error. Capture the
  // browser events as well so a tester sees the failure even when React or a
  // dependency renders its own fallback without logging a useful message.
  window.addEventListener("error", (event) => {
    addQaActivity({
      kind: "runtime",
      level: "error",
      title: "Uncaught browser error",
      detail: event.message || "The browser reported an unknown runtime error.",
      explanation:
        "JavaScript stopped unexpectedly outside a handled error boundary. The current control or part of the page may not finish updating.",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const detail = reason instanceof Error ? `${reason.name}: ${reason.message}` : stringifyArg(reason);
    addQaActivity({
      kind: "runtime",
      level: "error",
      title: "Unhandled async error",
      detail,
      explanation:
        "An asynchronous task failed without a recovery handler. Look immediately before this event for the action or request that started it.",
    });
  });
}

install();

export function getConsoleLogs(): ConsoleEntry[] {
  return [...consoleBuffer];
}

export function getNetworkErrors(): NetworkEntry[] {
  return [...networkBuffer];
}

export function getCounts(): { console: number; network: number } {
  return { console: consoleBuffer.length, network: networkBuffer.length };
}

/** Set the account attached to events recorded after this call. */
export function setQaRecorderContext(
  input: { email: string | null; label: string | null } | null,
) {
  if (typeof window === "undefined") return;
  qaCaptureActive = input !== null;
  if (!input) {
    qaActorEmail = null;
    qaActorLabel = null;
    return;
  }
  hydrateQaActivity();
  qaActorEmail = input.email;
  qaActorLabel = input.label;
}

/** Record a privacy-safe tester action, route change, or manual checkpoint. */
export function recordQaActivity(
  input: Omit<QaActivityEntry, "id" | "timestamp" | "path" | "actorEmail" | "actorLabel"> & {
    path?: string;
  },
) {
  addQaActivity(input);
}

export function getQaRecorderState(): QaRecorderState {
  hydrateQaActivity();
  return {
    entries: [...qaActivityBuffer],
    enabled: qaRecordingEnabled,
    startedAt: qaStartedAt || nowIso(),
  };
}

export function subscribeQaRecorder(listener: () => void): () => void {
  qaListeners.add(listener);
  return () => qaListeners.delete(listener);
}

export function setQaRecordingEnabled(enabled: boolean) {
  hydrateQaActivity();
  if (qaRecordingEnabled === enabled) return;
  qaRecordingEnabled = enabled;
  addQaActivity(
    {
      kind: "checkpoint",
      level: "info",
      title: enabled ? "Recording resumed" : "Recording paused",
      detail: enabled
        ? "New test actions and errors will be added to this session."
        : "New events will not be added until recording resumes.",
      explanation: enabled
        ? "The existing timeline was kept and recording continued."
        : "Pause hides nothing already captured. It only stops new timeline entries.",
    },
    true,
  );
  persistQaActivity();
  notifyQaListeners();
}

export function clearQaActivity() {
  hydrateQaActivity();
  qaActivityBuffer.splice(0, qaActivityBuffer.length);
  qaStartedAt = nowIso();
  persistQaActivity();
  notifyQaListeners();
}
