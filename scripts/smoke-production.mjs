import process from "node:process";

const base = (process.argv[2] || process.env.SMOKE_BASE_URL || "https://www.letsclick.app").replace(/\/$/, "");
const checks = [
  ["/", [200]],
  ["/discover", [200]],
  ["/login", [200]],
  ["/robots.txt", [200]],
  ["/sitemap.xml", [200]],
  ["/manifest.webmanifest", [200]],
  ["/api/health", [200]],
  // Routes that reach the native `sharp` module. A GET here is harmless - it is
  // either the operator gate (403) or Next's method-not-allowed (405) - but the
  // route module still has to LOAD to answer at all. When sharp failed to load
  // on the runtime these four served Vercel's static HTML 500 instead, and the
  // bug reporter was down for weeks with nothing catching it. Any 500 is a fail.
  ["/api/support/ticket", [403]],
  ["/api/upload/avatar", [405]],
  ["/api/upload/gallery", [405]],
  ["/api/upload/event-image", [405]],
  ["/tables", [404]],
  ["/test", [404]],
  ["/business", [404]],
  ["/scale", [404]],
  ["/api/tables/profiles/rows", [404]],
  ["/api/generate", [404]],
  ["/test-stage", [404]],
  ["/api/generate-stage", [404]],
  ["/api/test/supabase-log", [404]],
];

let failures = 0;
for (const [pathname, expected] of checks) {
  try {
    const response = await fetch(`${base}${pathname}`, { redirect: "manual" });
    const ok = expected.includes(response.status);
    console.log(`${ok ? "PASS" : "FAIL"}  ${response.status} ${pathname}`);
    if (!ok) failures += 1;

    if (pathname === "/") {
      for (const header of [
        "content-security-policy",
        "referrer-policy",
        "strict-transport-security",
        "x-content-type-options",
      ]) {
        const present = Boolean(response.headers.get(header));
        console.log(`${present ? "PASS" : "FAIL"}  header ${header}`);
        if (!present) failures += 1;
      }
    }
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${pathname}: ${error instanceof Error ? error.message : error}`);
  }
}

if (failures > 0) {
  console.error(`\nSmoke test failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log(`\nProduction smoke test passed for ${base}.`);
