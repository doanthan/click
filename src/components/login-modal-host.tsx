"use client";

import { useCallback, useEffect, useState } from "react";
import { LoginModal } from "./login-modal";

export type OpenLoginDetail = {
  callbackUrl?: string;
};

export const OPEN_LOGIN_EVENT = "click:open-login";

export function openLoginModal(detail: OpenLoginDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OpenLoginDetail>(OPEN_LOGIN_EVENT, { detail }));
}

type LoginModalHostProps = {
  googleConfigured: boolean;
  metaConfigured: boolean;
  showDemoCredentials: boolean;
};

export function LoginModalHost(props: LoginModalHostProps) {
  const [open, setOpen] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("/post-login");

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handle(event: Event) {
      const detail = (event as CustomEvent<OpenLoginDetail>).detail ?? {};
      const candidate = typeof detail.callbackUrl === "string" ? detail.callbackUrl : "";
      const safe =
        candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/post-login";

      // Callers say "bring me back HERE" by passing usePathname(), which drops
      // the query string - so signing in to RSVP from /discover?category=food
      // returned you to an unfiltered /discover with the filter, and often the
      // event you were looking at, gone. Re-attach the live search when the
      // caller handed us exactly the current path. An explicit destination
      // (home-quiz passes /quiz/personality) is left alone.
      const restored =
        safe === window.location.pathname && window.location.search
          ? `${safe}${window.location.search}`
          : safe;

      setCallbackUrl(restored);
      setOpen(true);
    }

    window.addEventListener(OPEN_LOGIN_EVENT, handle);
    return () => window.removeEventListener(OPEN_LOGIN_EVENT, handle);
  }, []);

  return (
    <LoginModal
      open={open}
      onClose={close}
      callbackUrl={callbackUrl}
      googleConfigured={props.googleConfigured}
      metaConfigured={props.metaConfigured}
      showDemoCredentials={props.showDemoCredentials}
    />
  );
}
