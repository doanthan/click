"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * HOTFIX 2026-10-12 H4.1: an admin viewing a real member can look, never act.
 * A disabled fieldset disables every control under it natively - buttons,
 * inputs, selects - while links still navigate. This is the half you can see;
 * src/proxy.ts refuses the writes regardless. /account-switch stays live: it
 * is the way out (Return, or switching account).
 */
export function ViewOnlyFieldset({ viewOnly, children }: { viewOnly: boolean; children: ReactNode }) {
  const pathname = usePathname();
  if (!viewOnly || pathname === "/account-switch") return <>{children}</>;
  return (
    <fieldset disabled className="contents">
      {children}
    </fieldset>
  );
}
