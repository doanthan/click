/** Remove only Auth.js session refreshes from the proxy response. */
export function withoutSessionRefreshCookies(headers: Headers): void {
  const cookies = headers.getSetCookie();
  headers.delete("set-cookie");
  for (const cookie of cookies) {
    // Both HTTP/HTTPS defaults, including chunked JWT cookies. Other cookies
    // (including Supabase refreshes and the QA unlock) must pass through.
    if (/^(?:__Secure-)?authjs\.session-token(?:\.\d+)?=/.test(cookie)) continue;
    headers.append("set-cookie", cookie);
  }
}
