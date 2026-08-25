/**
 * Auth surface primitives - shared by /login, /register (via register-form) and
 * the login modal, so the three sign-in surfaces are ONE treatment (the DS's
 * first rule: a component is never restyled per page). Before this, each of the
 * three carried its own copy of the Google + Facebook marks and its own SSO
 * button, and they had already drifted.
 *
 * Ported from `context/Click Design System/click-app-v2/auth.jsx`: a calm
 * centred column on cream, white fields with a Mist hairline, and BOTH SSO
 * buttons as the DS secondary button - no Facebook-blue block (that hex is not
 * in the palette), no window chrome, no offset shadow.
 *
 * Hook-free and presentational, so the same code renders on the server (the
 * /login page) and inside client components (register-form, login-modal).
 */
import { TOKEN_TTL_MINUTES } from "@/lib/magic-link-ttl";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, Logo, ckBtn, type IconName } from "@/components/ds";

/* ---------------------------------------------------------------- brand marks */
/* Third-party marks keep their own brand colours - that is the one place our
   palette gives way, and both sit on the same neutral white button. */

export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden style={{ flex: "none" }}>
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1Z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46Z" />
      <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17.1 2.1 20.4 2.1 24s.9 6.9 2.4 9.9l7.3-5.7Z" />
      <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9Z" />
    </svg>
  );
}

export function FacebookMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flex: "none" }}>
      <path
        fill="#1877F2"
        d="M22 12.061C22 6.504 17.523 2 12 2S2 6.504 2 12.061C2 17.084 5.657 21.245 10.438 22v-7.03H7.898v-2.91h2.54v-2.213c0-2.523 1.493-3.917 3.776-3.917 1.094 0 2.238.196 2.238.196v2.476h-1.262c-1.243 0-1.63.775-1.63 1.57v1.888h2.773l-.443 2.91h-2.33V22C18.343 21.245 22 17.084 22 12.061Z"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ SSO button */
/**
 * The DS secondary button (white / Mist hairline / lavender wash on hover),
 * full width. Identical footprint for Google and Facebook - the provider is
 * carried by the mark, never by a coloured slab.
 */
export function SsoButton({
  provider,
  label,
  disabled,
  trailing,
}: {
  provider: "google" | "facebook";
  label: string;
  disabled?: boolean;
  /** e.g. the "Last used" badge. */
  trailing?: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={ckBtn("secondary", "lg", { full: true })}
      aria-label={label}
    >
      <span className="ck-btn__label">
        {provider === "google" ? <GoogleMark /> : <FacebookMark />}
        {label}
        {trailing}
      </span>
    </button>
  );
}

/* ----------------------------------------------------------------------- field */
/**
 * A labelled field. The glyph is an absolutely-positioned overlay rather than a
 * flex sibling inside a bordered wrapper, so the app's global focus ring lands
 * on the input's own border instead of drawing a second box inside it.
 */
export function Field({
  label,
  icon,
  error,
  hint,
  action,
  ...input
}: {
  label: string;
  icon?: IconName;
  error?: string;
  hint?: ReactNode;
  /** Right-aligned affordance beside the label, e.g. "Forgot password?". */
  action?: ReactNode;
} & Omit<ComponentProps<"input">, "className">) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[13.5px] font-semibold text-[color:var(--ink)]">{label}</span>
        {action}
      </span>
      <span className="relative flex items-center">
        {icon ? (
          <Icon
            name={icon}
            size={18}
            className="pointer-events-none absolute left-3.5 text-[color:var(--slate)]"
          />
        ) : null}
        <input
          {...input}
          aria-invalid={error ? true : undefined}
          className={[
            "h-[50px] w-full rounded-xl border-[1.5px] bg-[color:var(--paper)] pr-3.5 text-base text-[color:var(--ink)]",
            "placeholder:text-[color:var(--ink-faint)]",
            icon ? "pl-11" : "pl-3.5",
            error ? "border-[color:var(--danger)]" : "border-[color:var(--mist-strong)]",
          ].join(" ")}
        />
      </span>
      {error ? (
        <span role="alert" className="text-[12.5px] font-medium text-[color:var(--danger)]">
          {error}
        </span>
      ) : hint ? (
        <span className="text-[12.5px] leading-[1.5] text-[color:var(--slate)]">{hint}</span>
      ) : null}
    </label>
  );
}

/* -------------------------------------------------------------------- divider */

export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="h-px flex-1 bg-[color:var(--mist)]" />
      <span className="text-[12.5px] font-medium text-[color:var(--ink-faint)]">{label}</span>
      <span className="h-px flex-1 bg-[color:var(--mist)]" />
    </div>
  );
}

/* ----------------------------------------------------------- signup role choice */
/**
 * Attend-or-Host, the fork at the top of every signup surface. Shared so the
 * modal and the /register page ask the same question the same way - the modal
 * used to be the ONLY place a host was offered a path, which meant anyone who
 * reached the full-page signup (the header's primary CTA lands there) never saw
 * that hosting existed.
 *
 * Controlled and hook-free, so it renders inside either client surface.
 */
export const HOST_SIGNUP_CALLBACK_URL = "/merchant/signup";

export type SignupRole = "attendee" | "host";

export function SignupRoleChoice({
  value,
  onChange,
  className = "",
}: {
  value: SignupRole;
  onChange: (role: SignupRole) => void;
  className?: string;
}) {
  return (
    <fieldset aria-label="What kind of account?" className={`grid grid-cols-2 gap-2.5 ${className}`}>
      {(
        [
          { value: "attendee", title: "Attend", body: "RSVP and meet people" },
          { value: "host", title: "Host", body: "List and run events" },
        ] as const
      ).map((option) => {
        const active = value === option.value;
        return (
          <label
            key={option.value}
            className={`cursor-pointer rounded-xl border-[1.5px] px-3.5 py-3 text-left transition-colors ${
              active
                ? "border-[color:var(--purple-500)] bg-[color:var(--lavender-100)]"
                : "border-[color:var(--mist-strong)] bg-[color:var(--paper)] hover:bg-[color:var(--lavender-100)]"
            }`}
          >
            <input
              type="radio"
              name="signup-role"
              value={option.value}
              checked={active}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="block text-[15px] font-semibold text-[color:var(--ink)]">
              {option.title}
            </span>
            <span className="mt-0.5 block text-[12.5px] text-[color:var(--slate)]">
              {option.body}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ error note */
/* Destructive red (--danger), never coral - coral is a status badge colour. */

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,var(--paper))] px-3.5 py-3 text-[13.5px] font-medium leading-[1.45] text-[color:var(--danger)]"
    >
      <Icon name="info" size={16} className="mt-px text-[color:var(--danger)]" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/* ----------------------------------------------------------------- quiet note */
/* The one tinted panel allowed on these surfaces: the lavender WASH (never
   brand lavender at section size). Carries the pilot / preview asides. */

export function AuthNote({ icon = "lock", children }: { icon?: IconName; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-[color:var(--lav-bg)] px-3.5 py-3">
      <Icon name={icon} size={15} className="mt-0.5 text-[color:var(--purple)]" />
      <div className="min-w-0 text-[12.5px] leading-[1.55] text-[color:var(--purple-800)]">
        {children}
      </div>
    </div>
  );
}

/**
 * "Check your inbox", said properly - on all three sign-in surfaces at once.
 *
 * The old copy named neither the inbox nor the clock, which left the single
 * most common failure of this flow (one character wrong in the address) with
 * nothing on screen to check against: you sit waiting for mail that went to
 * someone else. So it names the address it actually sent to, quotes the TTL the
 * server enforces, and points at the field below - re-submitting the form IS
 * the resend, so there is no second control to build.
 */
export function MagicLinkSentNote({
  email,
  mode = "signin",
}: {
  email?: string | null;
  mode?: "signin" | "signup";
}) {
  return (
    <AuthNote icon="mail">
      {email ? (
        <>
          We sent a one-time{" "}
          {mode === "signup" ? "link that finishes creating your account" : "sign-in link"} to{" "}
          <strong className="font-semibold">{email}</strong>. It works once and expires in{" "}
          {TOKEN_TTL_MINUTES} minutes.
          <br />
          Wrong address, or nothing arrived? Check your spam, or retype it below and send again.
        </>
      ) : (
        <>
          Check your inbox for a one-time{" "}
          {mode === "signup" ? "link that finishes creating your account" : "sign-in link"}. It
          works once and expires in {TOKEN_TTL_MINUTES} minutes.
        </>
      )}
    </AuthNote>
  );
}

/* ---------------------------------------------------------------------- shell */
/**
 * The auth page frame: one calm centred column on the cream ground. No split
 * hero, no window chrome - the DS reference (auth.jsx `Frame`) ships with its
 * split panel switched off.
 */
export function AuthShell({
  title,
  sub,
  children,
  footer,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen justify-center bg-[color:var(--champagne)] px-5 py-10 text-[color:var(--ink)] sm:py-14">
      <div className="w-full max-w-[412px]">
        {/* The global header is hidden on the auth routes (ChromeGate), so this
            wordmark is the only way back out - it has to be a link. */}
        <Link href="/" aria-label="Click home" className="inline-flex">
          <Logo size={28} />
        </Link>
        <h1 className="font-display mt-7 text-[26px] font-semibold leading-[1.15] tracking-[-0.01em] text-[color:var(--ink)]">
          {title}
        </h1>
        {sub ? (
          <p className="mt-1.5 text-[14.5px] leading-[1.5] text-[color:var(--slate)]">{sub}</p>
        ) : null}
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </main>
  );
}
