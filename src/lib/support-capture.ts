/**
 * Always-on client-side capture for the bug reporter.
 *
 * Importing this module (once, from the client SupportWidget) starts capturing
 * immediately: it monkey-patches console.* and wraps fetch + XHR so that when a
 * tester opens the panel we already have the recent console output and any
 * failed network requests for the current page.
 *
 * Everything is bounded (50 console / 20 network) and secrets are redacted in
 * the browser before they ever reach the API. Safe to import on the server —
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

const MAX_CONSOLE = 50;
const MAX_NETWORK = 20;
const TRUNCATE = 500;

const consoleBuffer: ConsoleEntry[] = [];
const networkBuffer: NetworkEntry[] = [];

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
        pushConsole({
          level,
          message: truncate(redact(args.map(stringifyArg).join(" "))),
          timestamp: nowIso(),
        });
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
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      try {
        const res = await originalFetch(input, init);
        if (res.status === 0 || res.status >= 400) {
          pushNetwork({
            method,
            url,
            status: res.status,
            duration: Math.round(performance.now() - start),
            timestamp: nowIso(),
            body: truncate(redact(typeof init?.body === "string" ? init.body : "")),
          });
        }
        return res;
      } catch (err) {
        pushNetwork({
          method,
          url,
          status: 0,
          duration: Math.round(performance.now() - start),
          timestamp: nowIso(),
          body: truncate(redact(err instanceof Error ? err.message : String(err))),
        });
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
      if (this.status === 0 || this.status >= 400) {
        pushNetwork({
          method: meta.method,
          url: meta.url,
          status: this.status,
          duration: Math.round(performance.now() - start),
          timestamp: nowIso(),
          body: truncate(redact(typeof body === "string" ? body : "")),
        });
      }
    });
    // eslint-disable-next-line prefer-rest-params
    return originalSend.apply(this, arguments as unknown as Parameters<typeof originalSend>);
  };
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
