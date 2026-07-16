"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./ds";

// Share an event via the device's native share sheet (text / email / WhatsApp /
// Messenger / Instagram etc. on mobile) with a desktop fallback menu of direct
// links + copy-to-clipboard. Available on every event — locked or unlocked —
// because sharing the listing URL never leaks the (RSVP-gated) venue.
export function ShareEventButton({
  title,
  slug,
}: {
  title: string;
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(`/events/${slug}`);
  const ref = useRef<HTMLDivElement>(null);

  // Build the absolute URL on the client so shares carry the real origin
  // (letsclick.app) rather than a bare path.
  useEffect(() => {
    setShareUrl(`${window.location.origin}/events/${slug}`);
  }, [slug]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const shareText = `Check out ${title} on Click`;

  async function handleClick() {
    // Native share sheet on supporting devices (mobile + some desktops). This is
    // the path that surfaces Messages, WhatsApp, Messenger, Instagram, email, …
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: shareUrl });
        return;
      } catch {
        // User dismissed the sheet, or share failed — fall through to the menu.
      }
    }
    setOpen((o) => !o);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — leave the menu open so the user can copy manually.
    }
  }

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);
  const links: { label: string; href: string }[] = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodedText}%20${encodedUrl}` },
    {
      label: "Facebook Messenger",
      href: `https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=0&redirect_uri=${encodedUrl}`,
    },
    { label: "Email", href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}%20${encodedUrl}` },
    { label: "SMS", href: `sms:?&body=${encodedText}%20${encodedUrl}` },
    {
      label: "X / Twitter",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
  ];

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        aria-haspopup="menu"
        aria-expanded={open}
        className="ck-btn ck-btn--secondary ck-btn--sm"
      >
        <Icon name="share" size={14} />
        Share event
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] shadow-[var(--shadow-md)]"
        >
          <button
            type="button"
            onClick={copyLink}
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2.5 text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
