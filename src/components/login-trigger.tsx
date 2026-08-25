"use client";

import { usePathname } from "next/navigation";
import { openLoginModal } from "./login-modal-host";

export function LoginTrigger({ className }: { className?: string }) {
  const pathname = usePathname();

  const callbackUrl = pathname || "/dashboard";

  // A real href, upgraded to the modal when JS is alive. Progressive
  // enhancement matters here specifically: this is the only way into the
  // product for a signed-out visitor, and its neighbour is already a link.
  return (
    <a
      href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
      onClick={(event) => {
        // Let the browser handle modified clicks (new tab, new window).
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
          return;
        }
        event.preventDefault();
        openLoginModal({ callbackUrl });
      }}
      className={className}
    >
      Log in
    </a>
  );
}
