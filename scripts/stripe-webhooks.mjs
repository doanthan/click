// Points Stripe's webhooks at /api/webhooks/stripe with every event the route
// handles (fix 2 of context/MERCHANT_STRIPE_AUDIT_FOR_CINDY.md). Uses whichever
// key .env.production.local holds, so it serves the sandbox now and live mode
// at the flip. Safe to re-run: existing endpoints only gain missing events.
//
//   node scripts/stripe-webhooks.mjs
//
// Two v1 endpoints, because Stripe scopes an endpoint to one side:
// - platform ("@self"): checkout, refunds, disputes. Signs STRIPE_WEBHOOK_SECRET.
// - connected accounts ("other_accounts"): payout.* and account.updated, which
//   happen on hosts' accounts. Signs STRIPE_WEBHOOK_SECRET_CONNECT.
// A signing secret is only readable when an endpoint is created, so a newly
// created endpoint's secret is written to .env.production.local and to Vercel
// production. Never printed. Redeploy afterwards so functions read it.
//
// The v2 thin destination (STRIPE_WEBHOOK_SECRET_V2) is not managed here.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import Stripe from "stripe";
import {
  CONNECTED_ACCOUNT_WEBHOOK_EVENTS,
  REQUIRED_STRIPE_WEBHOOK_EVENTS,
} from "../src/lib/stripe-webhook-events.ts";

const ENV_FILE = ".env.production.local";
const envText = readFileSync(ENV_FILE, "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, "$2")]),
);
if (!env.STRIPE_SECRET_KEY || !env.NEXT_PUBLIC_APP_URL) {
  console.error(`STRIPE_SECRET_KEY and NEXT_PUBLIC_APP_URL must be set in ${ENV_FILE}.`);
  process.exit(1);
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const url = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/webhooks/stripe`;
console.log(`Stripe ${env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "LIVE" : "sandbox"} -> ${url}`);

// The v1 list does not say which side an endpoint listens to; the v2
// destinations list does, under the same id.
const scope = new Map();
const destinations = await stripe.rawRequest("GET", "/v2/core/event_destinations", {});
for (const d of destinations.data ?? []) scope.set(d.id, d.events_from ?? []);

const endpoints = [];
for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 })) {
  if (endpoint.url.replace(/\/$/, "") === url) endpoints.push(endpoint);
}
const isConnect = (endpoint) => (scope.get(endpoint.id) ?? []).includes("other_accounts");

const connectEvents = [...CONNECTED_ACCOUNT_WEBHOOK_EVENTS];
const platformEvents = REQUIRED_STRIPE_WEBHOOK_EVENTS.filter(
  (event) => !CONNECTED_ACCOUNT_WEBHOOK_EVENTS.includes(event),
);
const apiVersion = endpoints[0]?.api_version ?? undefined;

async function ensure(label, existing, events, secretName, connect) {
  if (existing.length > 1) {
    console.error(`${label}: ${existing.length} endpoints at ${url} - remove the extras in the Stripe dashboard, then re-run.`);
    process.exit(1);
  }
  if (existing.length === 1) {
    const [endpoint] = existing;
    const merged = [...new Set([...endpoint.enabled_events, ...events])];
    if (merged.length !== endpoint.enabled_events.length || endpoint.status !== "enabled") {
      await stripe.webhookEndpoints.update(endpoint.id, { enabled_events: merged, disabled: false });
    }
    console.log(`${label}: ${endpoint.enabled_events.length} -> ${merged.length} events (kept its secret).`);
    return;
  }
  const created = await stripe.webhookEndpoints.create({
    url,
    connect,
    enabled_events: events,
    ...(apiVersion ? { api_version: apiVersion } : {}),
    description: `Click - ${label}`,
  });
  saveSecret(secretName, created.secret);
  console.log(`${label}: created with ${events.length} events; ${secretName} saved to ${ENV_FILE} and Vercel production.`);
}

function saveSecret(name, secret) {
  const line = `${name}=${secret}`;
  const current = readFileSync(ENV_FILE, "utf8");
  const pattern = new RegExp(`^${name}=.*$`, "m");
  writeFileSync(ENV_FILE, pattern.test(current) ? current.replace(pattern, line) : `${current.replace(/\n?$/, "\n")}${line}\n`);
  spawnSync("npx", ["vercel", "env", "rm", name, "production", "--yes"], { stdio: "ignore" });
  const added = spawnSync("npx", ["vercel", "env", "add", name, "production"], {
    input: secret,
    stdio: ["pipe", "ignore", "pipe"],
  });
  if (added.status !== 0) {
    console.error(`Could not set ${name} on Vercel: ${String(added.stderr).trim()}`);
    console.error(`It is in ${ENV_FILE}; add it on Vercel by hand.`);
  }
}

await ensure(
  "platform events",
  endpoints.filter((endpoint) => !isConnect(endpoint)),
  platformEvents,
  "STRIPE_WEBHOOK_SECRET",
  false,
);
await ensure(
  "payouts and account updates from hosts' accounts",
  endpoints.filter(isConnect),
  connectEvents,
  "STRIPE_WEBHOOK_SECRET_CONNECT",
  true,
);
console.log("Done. Redeploy so production reads any new secret.");
