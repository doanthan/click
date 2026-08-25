import assert from "node:assert/strict";
import test from "node:test";

import { normalizeWebsiteUrl, validateWebsiteUrl } from "../src/lib/website-url.ts";

// The merchant signup wizard had no rule for the optional Website field at all,
// so the server's rule was the first thing a host heard about it - as a bounce
// on the Documents step, two routes from the input, for typing the http:// URL
// their own site redirects from. Both sides import this module now, and an
// explicit http:// is upgraded rather than refused.

test("a bare hostname and an http:// URL both come out as https://", () => {
  assert.equal(normalizeWebsiteUrl("mybusiness.com.au").url, "https://mybusiness.com.au");
  assert.equal(normalizeWebsiteUrl("http://mybusiness.com.au").url, "https://mybusiness.com.au");
  assert.equal(normalizeWebsiteUrl("HTTP://mybusiness.com.au").url, "https://mybusiness.com.au");
  assert.equal(validateWebsiteUrl("http://mybusiness.com.au"), null);
});

test("the field stays optional", () => {
  assert.equal(normalizeWebsiteUrl("   ").url, "");
  assert.equal(validateWebsiteUrl(""), null);
});

test("something that isn't a domain is still refused - now on the field", () => {
  assert.match(validateWebsiteUrl("mybusiness"), /valid website domain/);
});

test("the path a host pastes survives", () => {
  assert.equal(
    normalizeWebsiteUrl("mybusiness.com.au/book?ref=click").url,
    "https://mybusiness.com.au/book?ref=click",
  );
});
