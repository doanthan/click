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
  const [callbackUrl, setCallbackUrl] = useState("/dashboard");

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handle(event: Event) {
      const detail = (event as CustomEvent<OpenLoginDetail>).detail ?? {};
      const candidate = typeof detail.callbackUrl === "string" ? detail.callbackUrl : "";
      const safe =
        candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/dashboard";
      setCallbackUrl(safe);
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
