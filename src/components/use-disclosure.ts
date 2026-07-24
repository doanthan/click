"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Disclosure state for the header dropdowns (account menu, notifications bell,
 * portal mobile nav). One shared behaviour so every menu closes the same way:
 * outside click, Escape (returning focus to the trigger - the widget's first
 * button), or keyboard focus leaving the widget. Listeners attach only while
 * open, so a closed menu costs nothing and never swallows Escape.
 */
export function useDisclosure<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    if (!root) return;

    function onDocPointerDown(e: MouseEvent | TouchEvent) {
      if (!root!.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        root!.querySelector<HTMLElement>("button")?.focus();
      }
    }
    function onFocusOut(e: FocusEvent) {
      if (e.relatedTarget && !root!.contains(e.relatedTarget as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("touchstart", onDocPointerDown);
    document.addEventListener("keydown", onKeyDown);
    root.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("touchstart", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  return { open, setOpen, ref };
}
