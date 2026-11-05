// Points Stripe's webhooks at /api/webhooks/stripe with every event the route
// handles (fix 2 of context/MERCHANT_STRIPE_AUDIT_FOR_CINDY.md). Uses whichever
// key .env.production.local holds, so it serves the sandbox and live mode
// alike. Safe to re-run: existing destinations only gain missing events.
//
//   node scripts/stripe-webhooks.mjs
//
// Three event destinations, all posting to the same route:
// - platform  (snapshot, @self):     checkout, refunds, disputes  -> STRIPE_WEBHOOK_SECRET
// - hosts     (snapshot, @accounts): payout.*, account.updated    -> STRIPE_WEBHOOK_SECRET_CONNECT
// - accounts  (thin, @self):         v2.core.account*             -> STRIPE_WEBHOOK_SECRET_V2
// A signing secret is only returned when a destination is created, so a new
// destination's secret is written to .env.production.local and to Vercel
// production. Never printed. Redeploy afterwards so functions read it.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import Stripe from "stripe";
import {
  CONNECTED_ACCOUNT_WEBHOOK_EVENTS,
  REQUIRED_STRIPE_WEBHOOK_EVENTS,
} from "../src/lib/stripe-webhook-events.ts";

const ENV_FILE = ".env.production.local";
// Matches the client in src/lib/stripe.ts, so snapshot payloads parse the same.
const API_VERSION = "2026-05-27.dahlia";
// What the route's isConnectAccountEventType acts on.
const THIN_ACCOUNT_EVENTS = [
  "v2.core.account.closed",
  "v2.core.account.created",
  "v2.core.account.updated",
  "v2.core.account[configuration.customer].capability_status_updated",
  "v2.core.account[configuration.customer].updated",
  "v2.core.account[configuration.merchant].capability_status_updated",
  "v2.core.account[configuration.merchant].updated",
  "v2.core.account[configuration.recipient].capability_status_updated",
  "v2.core.account[configuration.recipient].updated",
  "v2.core.account[defaults].updated",
  "v2.core.account[future_requirements].updated",
  "v2.core.account[identity].updated",
  "v2.core.account[requirements].updated",
];

const env = Object.fromEntries(
  readFileSync(ENV_FILE, "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, "$2")]),
);
if (!env.STRIPE_SECRET_KEY || !env.NEXT_PUBLIC_APP_URL) {
  console.error(`STRIPE_SECRET_KEY and NEXT_PUBLIC_APP_URL must be set in ${ENV_FILE}.`);
  process.exit(1);
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: API_VERSION });
const url = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/webhooks/stripe`;
console.log(`Stripe ${env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "LIVE" : "sandbox"} -> ${url}`);

const page = await stripe.v2.core.eventDestinations.list({ limit: 100, include: ["webhook_endpoint.url"] });
const ours = page.data.filter(
  (d) => d.type === "webhook_endpoint" && d.webhook_endpoint?.url?.replace(/\/$/, "") === url,
);

const wanted = [
  {
    label: "platform events",
    payload: "snapshot",
    from: "@self",
    events: REQUIRED_STRIPE_WEBHOOK_EVENTS.filter((e) => !CONNECTED_ACCOUNT_WEBHOOK_EVENTS.includes(e)),
    secretName: "STRIPE_WEBHOOK_SECRET",
  },
  {
    label: "payouts and account updates from hosts' accounts",
    payload: "snapshot",
    from: "@accounts",
    events: [...CONNECTED_ACCOUNT_WEBHOOK_EVENTS],
    secretName: "STRIPE_WEBHOOK_SECRET_CONNECT",
  },
  {
    label: "v2 account notifications",
    payload: "thin",
    from: "@self",
    events: THIN_ACCOUNT_EVENTS,
    secretName: "STRIPE_WEBHOOK_SECRET_V2",
  },
];

for (const want of wanted) {
  const existing = ours.filter(
    (d) => d.event_payload === want.payload && (d.events_from ?? ["@self"]).includes(want.from),
  );
  if (existing.length > 1) {
    console.error(`${want.label}: ${existing.length} destinations at ${url} - remove the extras in the Stripe dashboard, then re-run.`);
    process.exit(1);
  }
  if (existing.length === 1) {
    const [d] = existing;
    const merged = [...new Set([...d.enabled_events, ...want.events])];
    if (merged.length !== d.enabled_events.length) {
      await stripe.v2.core.eventDestinations.update(d.id, { enabled_events: merged });
    }
    if (d.status !== "enabled") await stripe.v2.core.eventDestinations.enable(d.id);
    console.log(`${want.label}: ${d.enabled_events.length} -> ${merged.length} events (kept its secret).`);
    continue;
  }
  const created = await stripe.v2.core.eventDestinations.create({
    name: `Click ${want.label}`.slice(0, 100),
    type: "webhook_endpoint",
    event_payload: want.payload,
    events_from: [want.from],
    enabled_events: want.events,
    ...(want.payload === "snapshot" ? { snapshot_api_version: API_VERSION } : {}),
    webhook_endpoint: { url },
    include: ["webhook_endpoint.signing_secret"],
  });
  const secret = created.webhook_endpoint?.signing_secret;
  if (!secret) {
    console.error(`${want.label}: created ${created.id}, but Stripe returned no signing secret - copy it from the dashboard into ${want.secretName}.`);
    continue;
  }
  saveSecret(want.secretName, secret);
  console.log(`${want.label}: created with ${want.events.length} events; ${want.secretName} saved to ${ENV_FILE} and Vercel production.`);
}
console.log("Done. Redeploy so production reads any new secret.");

function saveSecret(name, secret) {
  const line = `${name}=${secret}`;
  const current = readFileSync(ENV_FILE, "utf8");
  const pattern = new RegExp(`^${name}=.*$`, "m");
  writeFileSync(
    ENV_FILE,
    pattern.test(current) ? current.replace(pattern, line) : `${current.replace(/\n?$/, "\n")}${line}\n`,
  );
  // --force overwrites in place, so a failed write never leaves production without the variable.
  const added = spawnSync("npx", ["vercel", "env", "add", name, "production", "--force", "--sensitive", "--yes"], {
    input: secret,
    stdio: ["pipe", "ignore", "pipe"],
  });
  if (added.status !== 0) {
    console.error(`Could not set ${name} on Vercel: ${String(added.stderr).trim()}`);
    console.error(`It is in ${ENV_FILE}; add it on Vercel by hand.`);
  }
}
