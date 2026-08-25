"use client";

import { useEffect, useState } from "react";

/**
 * Live mm:ss remaining on a checkout hold. The hold is 31 minutes and nothing
 * in the UI ever named it, so a buyer who stepped away could not tell whether
 * the seat was still theirs. Same treatment the waitlist offer already uses.
 */
export function PaymentHoldCountdown({ expiresAt }: { expiresAt: string }) {
  // null until mounted, so the countdown can never cause a hydration mismatch.
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    // No synchronous setState here: the first tick lands after ~1s and the
    // component renders nothing until then, which is also what keeps the
    // countdown out of the server-rendered HTML.
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (nowMs == null) return null;

  const msLeft = new Date(expiresAt).getTime() - nowMs;
  if (msLeft <= 0) return <>The hold has expired - the seats went back to the pool.</>;

  const mins = Math.floor(msLeft / 60000);
  const secs = String(Math.floor((msLeft % 60000) / 1000)).padStart(2, "0");
  return (
    <>
      Held for <span className="font-semibold tabular-nums">{`${mins}:${secs}`}</span> more.
    </>
  );
}
