"use client";

import { usePathname } from "next/navigation";
import { openLoginModal } from "./login-modal-host";

export function LoginTrigger({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <button
      type="button"
      onClick={() => openLoginModal({ callbackUrl: pathname || "/dashboard" })}
      className={className}
    >
      Log in
    </button>
  );
}
