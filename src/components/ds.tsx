/**
 * Click Design System - the canonical primitives.
 *
 * Ported from `context/Click Design System/` (the claude.ai/design export;
 * `click-app-v2/kit.jsx` + `components/`). That bundle is the source of truth -
 * when it is re-exported, diff against it and update THIS file; never edit the
 * bundle. The DS rule that matters most: ONE component, used identically
 * site-wide. A Button/Tag/Badge/EventCard/PeopleCard is never restyled per page.
 *
 * Everything here is presentational and hook-free, so it renders on the server
 * and can also be imported by client components. Interactive behaviour lives in
 * the caller; the visual states (hover/active/focus/disabled) are real CSS
 * pseudo-classes in globals.css (.ck-btn / .ck-tag), not JS handlers.
 */
import Link from "next/link";
import type { ComponentProps, CSSProperties, MouseEvent, ReactNode } from "react";
import { resolveAvatarImage } from "@/lib/avatar-images";

/* ============================ brand marks ============================ */

/* The sparkle geometry from the Brand Package: a 4-point star whose arms are
   cubic beziers. `w` is the arm waist (lower = spikier), `p` the shoulder pull. */
function sparkPath(cx: number, cy: number, r: number, w = 0.46, p = 0.065) {
  const n = (v: number) => Math.round(v * 100) / 100;
  return [
    `M${n(cx)} ${n(cy - r)}`,
    `C${n(cx + p * r)} ${n(cy - w * r)} ${n(cx + w * r)} ${n(cy - p * r)} ${n(cx + r)} ${n(cy)}`,
    `C${n(cx + w * r)} ${n(cy + p * r)} ${n(cx + p * r)} ${n(cy + w * r)} ${n(cx)} ${n(cy + r)}`,
    `C${n(cx - p * r)} ${n(cy + w * r)} ${n(cx - w * r)} ${n(cy + p * r)} ${n(cx - r)} ${n(cy)}`,
    `C${n(cx - w * r)} ${n(cy - p * r)} ${n(cx - p * r)} ${n(cy - w * r)} ${n(cx)} ${n(cy - r)}`,
    "Z",
  ].join(" ");
}

/**
 * Spark - the brand double-sparkle (a big glint + a small companion).
 * The ONE spot of lavender. Rationed hard: the three mechanic peaks (mutual
 * reveal / both-going / closure) and the nav "click" only. Never decoration,
 * never on a list row, never the orange emoji.
 */
export function Spark({
  size = 20,
  tone = "var(--lavender)",
  toneSmall,
  className,
}: {
  size?: number;
  tone?: string;
  /** The companion glint. Defaults to `tone`; the nav pairs purple with a lighter purple. */
  toneSmall?: string;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden className={className} style={{ flex: "none" }}>
      <path d={sparkPath(46, 66, 34, 0.44)} fill={tone} />
      <path d={sparkPath(74, 36, 13, 0.4)} fill={toneSmall ?? tone} />
    </svg>
  );
}

/**
 * Logo - the lowercase `click` wordmark. Poppins SemiBold, and the i is
 * DOTLESS (U+0131) so the sparkle-pair can sit in as its dot.
 */
export function Logo({ size = 26, cream = false }: { size?: number; cream?: boolean }) {
  const color = cream ? "var(--champagne)" : "var(--purple)";
  const sparkSize = Math.round(size * 0.4);
  const lift = Math.round(size * -0.34);
  return (
    <span
      className="font-display"
      style={{
        fontWeight: 600,
        letterSpacing: "-0.02em",
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "baseline",
        whiteSpace: "nowrap",
        fontSize: size,
        color,
      }}
    >
      cl
      <span style={{ position: "relative", display: "inline-block" }}>
        {"ı"}
        <span style={{ position: "absolute", left: "50%", bottom: `calc(100% + ${lift}px)`, transform: "translateX(-42%)" }}>
          <Spark size={sparkSize} />
        </span>
      </span>
      ck
    </span>
  );
}

/** CMark - the bare `c` cradling the sparkle pair. Favicon / avatar / app tile. */
export function CMark({ size = 40, tone = "var(--purple)" }: { size?: number; tone?: string }) {
  return (
    <span
      aria-hidden
      className="font-display"
      style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1, fontSize: size, flex: "none" }}
    >
      <span style={{ fontWeight: 600, fontSize: "1em", color: tone, letterSpacing: "-0.02em" }}>c</span>
      <span style={{ position: "absolute", left: "0.47em", top: "0.11em", width: "0.34em", height: "0.34em", lineHeight: 0 }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
          <path d={sparkPath(50, 50, 44)} fill="var(--lavender)" />
        </svg>
      </span>
      <span style={{ position: "absolute", left: "0.71em", top: "-0.1em", width: "0.15em", height: "0.15em", lineHeight: 0 }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
          <path d={sparkPath(50, 50, 44, 0.4)} fill="var(--lavender)" />
        </svg>
      </span>
    </span>
  );
}

/* ============================ icons ============================ */
/* Lucide-style line glyphs, even stroke, currentColor. Emoji are never icons. */
const ICON_PATHS = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
  calendar: "M8 2v3M16 2v3M3.5 9h17M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  pin: "M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  bookmark: "M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1Z",
  check: "M20 6 9 17l-5-5",
  chevL: "M15 18l-6-6 6-6",
  chevR: "M9 6l6 6-6 6",
  chevD: "M6 9l6 6 6-6",
  arrowR: "M5 12h14M13 6l6 6-6 6",
  lock: "M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM8 11V8a4 4 0 0 1 8 0v3",
  users: "M16 19a4 4 0 0 0-8 0M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19a3.2 3.2 0 0 0-3-3.2M18 11.2A3 3 0 0 0 18 5.4",
  user: "M5 20a7 7 0 0 1 14 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  home: "M3 11l9-8 9 8M5 9.5V21h14V9.5",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM15.5 8.5l-2 5-5 2 2-5 5-2Z",
  x: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
  filter: "M3 5h18M6 12h12M10 19h4",
  send: "M5 12 20 4l-5 16-3.5-6.5L5 12Z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  camera: "M3 8.5a2 2 0 0 1 2-2h2L8.5 4.5h7L17 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM12 16.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z",
  mail: "M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7ZM3.5 7.5l8.5 6 8.5-6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.5h.01",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.1 9.5a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V13Z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  trend: "M4 16l5-5 3.5 3.5L20 7M15 7h5v5",
  music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  radar: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 12h.01",
  ticket: "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({
  name,
  size = 20,
  stroke = 1.9,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      style={{ flex: "none", ...style }}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/* ============================ button ============================ */
/* Radius 12, NEVER a pill. ONE footprint on every surface: the same Button is
   the RSVP, the "Suggest a plan", the banner action and the "click with". */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "onPurple" | "pending" | "mutual" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export function ckBtn(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  opts: { full?: boolean; className?: string } = {},
) {
  return ["ck-btn", `ck-btn--${size}`, `ck-btn--${variant}`, opts.full ? "ck-btn--full" : "", opts.className ?? ""]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  full,
  loading,
  className,
  children,
  onClick,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  /** In-flight. Renders aria-disabled + aria-busy, NOT the native `disabled`. */
  loading?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"button">, "className">) {
  const busy = Boolean(loading);
  const nativelyDisabled = Boolean(rest.disabled);

  /* Busy is NOT the same thing as disabled, and the difference is the whole
     reason this branch exists. The browser BLURS a focused element the instant
     it goes disabled, so `disabled={loading}` yanked focus off the button the
     user had just pressed and dumped keyboard and screen-reader users back at
     the top of the document, mid-action - the same anti-pattern the account
     settings toggles dropped. aria-disabled announces "not actionable" while
     leaving the control focusable, and aria-busy says why.

     An explicitly passed `disabled` is untouched and still renders a genuinely
     disabled control - that one is a real, caller-declared state (a submit with
     nothing to submit), not a transient in-flight blip. */
  const handleClick =
    busy || onClick
      ? (event: MouseEvent<HTMLButtonElement>) => {
          if (busy) {
            /* This guard - not the ARIA - is what actually stops a second
               submit. aria-disabled is advisory only: an aria-disabled submit
               button still posts its form natively. .ck-btn--loading's
               pointer-events:none blocks the MOUSE and nothing else.

               preventDefault is what closes all three routes in, because every
               one of them ends in a real click event whose DEFAULT ACTION is
               the submission: a pointer press, Enter/Space on the focused
               button, and implicit submission (Enter in a text field, which the
               HTML spec defines as firing a click at the form's default
               button). Cancel the click and no submit event is dispatched, so
               React's <form action={…}> never re-runs.

               stopPropagation is the separate half: it keeps a parent row or
               card onClick from treating the swallowed press as a navigation. */
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }
      : /* Attached CONDITIONALLY on purpose: ds.tsx has no "use client" and ~15
           Server Components render <Button>. A Server Component cannot serialise
           a function onto a host element, so an unconditional handler would
           break every one of them. `loading` only ever comes from client state
           (SubmitButton's useFormStatus, a useState), so busy implies a client
           component and the handler is safe exactly when it exists. */
        undefined;

  return (
    <button
      {...rest}
      aria-disabled={busy && !nativelyDisabled ? true : undefined}
      aria-busy={busy || undefined}
      onClick={handleClick}
      className={ckBtn(variant, size, { full, className: `${busy ? "ck-btn--loading" : ""} ${className ?? ""}` })}
    >
      <span className="ck-btn__label">{children}</span>
      {busy ? <span className="ck-btn__spinner" aria-hidden /> : null}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  full,
  className,
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, "className">) {
  return (
    <Link {...rest} className={ckBtn(variant, size, { full, className })}>
      <span className="ck-btn__label">{children}</span>
    </Link>
  );
}

/* ============================ form field ============================ */
/* ONE labelled control for the whole app - input, textarea and select share the
   .ck-input treatment defined in globals.css beside .ck-btn.

   Deliberately NOT called `Field`: auth-ui.tsx already exports a Field of its
   own (a 50px input with an inline glyph, tuned for the auth cards) and the six
   auth/onboarding sites that import it keep it. FormField is the wider,
   product-form sibling - it is the one to reach for everywhere else. */

/** The chrome every FormField shape shares, whatever control it wraps. */
type FormFieldChrome = {
  label: ReactNode;
  /** Renders a quiet Slate marker beside the label AND sets native `required`,
      so browser constraint validation still works with JS disabled. */
  required?: boolean;
  /** When set: --danger hairline, aria-invalid, and a role="alert" message. */
  error?: string;
  /** Shown only when there is no error, so the two never stack. */
  hint?: ReactNode;
  /** Right-aligned affordance beside the label, e.g. a character count. */
  action?: ReactNode;
  /** ESCAPE-HATCH PATH ONLY: the id of the one control inside `children` that
      the label names. Set it and the label becomes a real <label htmlFor>, so
      clicking the text focuses that control. Leave it off when the children are
      a group of controls rather than one (a chip row, a tag picker) - the
      wrapper then becomes role="group" and clicking the label does nothing,
      which is the correct behaviour for a group. */
  htmlFor?: string;
};

/* `children` rides in on each variant's native props:
   - as="select": the <option> list, as you would expect.
   - as="input" / "textarea": the ESCAPE HATCH. Pass children and FormField
     renders them INSTEAD of its own control, so a combobox, a date picker or a
     MapboxAutocomplete can borrow the label / required / error chrome. */
export type FormFieldProps =
  | (FormFieldChrome & { as?: "input" } & Omit<ComponentProps<"input">, "className">)
  | (FormFieldChrome & { as: "textarea" } & Omit<ComponentProps<"textarea">, "className">)
  | (FormFieldChrome & { as: "select" } & Omit<ComponentProps<"select">, "className">);

/* The chrome keys are peeled off before the rest is spread onto the DOM node -
   `label`, `error`, `hint` and `action` are ours, not attributes, and React
   would otherwise warn about unknown props. `required` deliberately STAYS in
   the rest so it lands on the element as the native attribute, which is what
   gives the field browser constraint validation with JS disabled. */
const FORM_FIELD_CHROME = ["label", "as", "error", "hint", "action", "htmlFor"] as const;

function stripFormFieldChrome<P extends FormFieldProps>(props: P) {
  const control: Record<string, unknown> = { ...props };
  for (const key of FORM_FIELD_CHROME) delete control[key];
  return control as Omit<P, (typeof FORM_FIELD_CHROME)[number]>;
}

function formFieldControl(props: FormFieldProps, className: string, messageId?: string) {
  const invalid = props.error ? true : undefined;
  // The hint / error text describes the control, it is not part of its NAME -
  // so it hangs off aria-describedby and lives outside the <label> below. A
  // caller's own aria-describedby wins nothing here, but must not be dropped.
  const describedBy = messageId ?? props["aria-describedby"];

  if (props.as === "textarea") {
    return (
      <textarea
        {...stripFormFieldChrome(props)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={className}
      />
    );
  }
  if (props.as === "select") {
    return (
      <select
        {...stripFormFieldChrome(props)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={className}
      />
    );
  }
  return (
    <input
      {...stripFormFieldChrome(props)}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      className={className}
    />
  );
}

/**
 * A labelled form control. Hook-free and server-renderable like the rest of this
 * file, so it works inside a Server Component and with scripting off.
 *
 * On the NATIVE path the wrapper is a <label> and associates implicitly with the
 * control it wraps - the input/select/textarea is the only labelable descendant,
 * so that is exactly right.
 *
 * On the ESCAPE-HATCH path (children in place of the control) it is not. A
 * <label> forwards a click on its text to its first LABELABLE descendant, and
 * <button> is labelable - so clicking the word "Tags" fired the first tag's
 * Remove button and deleted it, and clicking "Who's this event for?" toggled the
 * first intent chip. The wrapper is a plain <div> there instead, and the label
 * text is associated explicitly:
 *   - `htmlFor` given → a real <label htmlFor>, so clicking it focuses that one
 *     control (the behaviour the implicit label was there for).
 *   - no `htmlFor` → the children are a GROUP, not one control, so the wrapper
 *     carries role="group" + the label as its accessible name and a click on the
 *     text correctly does nothing.
 *
 * The caller still owns .ck-input, aria-invalid and native `required` on that
 * path - only the label / marker / error chrome is ours.
 *
 * `content-start` matters: this is a grid, and a FormField sitting in a taller
 * grid row (a two-column pair where the sibling is a textarea, say) stretched
 * its own auto rows to fill, which is what turned the Category select into a
 * 166px-tall control instead of the 44px .ck-input is defined as.
 */
export function FormField(props: FormFieldProps) {
  const { label, required, error, hint, action, htmlFor } = props;

  const controlClass = [
    "ck-input",
    "w-full",
    error ? "ck-input--invalid" : "",
    props.as === "textarea" ? "ck-input--area" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // The escape hatch: on input/textarea, children replace the control entirely.
  // A select's children are its options, so they stay inside the control.
  const custom = props.as !== "select" && props.children !== undefined;

  const labelClass = "text-[13.5px] font-semibold text-[color:var(--ink)]";
  const labelText =
    custom && htmlFor ? (
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
    ) : (
      <span className={labelClass}>{label}</span>
    );

  const labelRow = (
    <span className="flex items-baseline justify-between gap-3">
      <span className="flex items-baseline gap-2">
        {labelText}
        {required ? (
          // aria-hidden: the native `required` attribute below is what actually
          // reaches assistive tech, so this marker is purely visual.
          <span aria-hidden className="text-[11.5px] font-medium text-[color:var(--slate)]">
            Required
          </span>
        ) : null}
      </span>
      {action}
    </span>
  );

  /* Only one message shows at a time, so one id does for both. It needs the
     control's own id to hang off - without one there is nothing to point
     aria-describedby at, and the message stays outside the label either way
     (it is a description, never part of the field's name). */
  const messageId = props.id ? `${props.id}-${error ? "error" : "hint"}` : undefined;
  const message = error ? (
    <span id={messageId} role="alert" className="text-[12.5px] font-medium text-[color:var(--danger)]">
      {error}
    </span>
  ) : hint ? (
    <span id={messageId} className="text-[12.5px] leading-[1.5] text-[color:var(--slate)]">
      {hint}
    </span>
  ) : null;

  // Only the escape-hatch path renders this now - the native one assembles its
  // own so the message can sit outside the <label>.
  const chrome = (
    <>
      {labelRow}
      {props.children}
      {message}
    </>
  );

  if (!custom) {
    /* The <label> wraps the label text and the control, and NOTHING else. It
       used to wrap the message too, which folded the whole hint paragraph into
       the field's accessible name: "Phone (AU) Mobile, landline or business line
       - e.g. ..." announced as the NAME on focus, and an error announced twice
       (once as part of the name, once by its own role="alert"). */
    return (
      <div className="grid content-start gap-1.5">
        <label className="grid gap-1.5">
          {labelRow}
          {formFieldControl(props, controlClass, messageId)}
        </label>
        {message}
      </div>
    );
  }

  // A group only earns its accessible name from a string label; a ReactNode
  // label has no text we can safely flatten, so we leave the role off rather
  // than announce an empty group.
  const groupLabel = !htmlFor && typeof label === "string" ? label : undefined;
  return (
    <div
      className="grid content-start gap-1.5"
      role={groupLabel ? "group" : undefined}
      aria-label={groupLabel}
    >
      {chrome}
    </div>
  );
}

/* ============================ endowed progress ============================ */

/* Endowed progress: the bar is already moving on step one, fast early and slower
   late, and it never renders 0 or 100 - 100 belongs to the done state, not to
   the last step of the form. Three byte-identical copies of this markup already
   exist (life-quiz-wizard, the personality wizard, onboarding-form); this is the
   one they collapse into. */
const ENDOWED_START = 24;
const ENDOWED_END = 92;
/* >1 bends the curve concave: big jumps on the first steps, small ones at the
   end, so the second half never feels like it stalled. */
const ENDOWED_EASE = 1.35;

function endowedPct(step: number, total: number) {
  if (total <= 1) return ENDOWED_END;
  const t = step / (total - 1);
  return ENDOWED_START + (ENDOWED_END - ENDOWED_START) * (1 - Math.pow(1 - t, ENDOWED_EASE));
}

export function EndowedProgress({
  step,
  total,
  pct,
  label,
  className = "",
}: {
  /** 0-indexed. */
  step: number;
  total: number;
  /** Override the derived curve, e.g. a real byte-count during an upload. */
  pct?: number;
  /** Replaces the counter line, e.g. "Creating 3 of 26". */
  label?: string;
  className?: string;
}) {
  const safeTotal = Math.max(1, Math.round(total));
  const current = Math.min(Math.max(Math.round(step), 0), safeTotal - 1);
  // Clamped either way: a caller-supplied pct must obey the same never-0,
  // never-100 rule, or the bar lies about being finished.
  const width = Math.round(Math.min(96, Math.max(8, pct ?? endowedPct(current, safeTotal))));
  const counter = label ?? `Step ${current + 1} of ${safeTotal}`;

  return (
    <div className={className}>
      <p className="font-display text-[12.5px] font-semibold text-[color:var(--slate)]">{counter}</p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--lav-bg)]"
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={safeTotal}
        aria-label={counter}
      >
        <div
          className="h-full rounded-full bg-[color:var(--purple)] transition-[width] duration-500 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

/* ============================ tag ============================ */
/* Interest tags: ONE neutral look everywhere. Selected = purple fill, NO tick.
   Status colour never lands on a tag. */

export function Tag({
  children,
  selected,
  dense,
  className,
  ...rest
}: { children: ReactNode; selected?: boolean; dense?: boolean; className?: string } & Omit<ComponentProps<"span">, "className">) {
  return (
    <span
      {...rest}
      className={["ck-tag", dense ? "ck-tag--dense" : "", selected ? "ck-tag--selected" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

/**
 * TagRow - as many WHOLE tags as fit on ONE line (hard cap `max`), then a single
 * neutral "+N" for the rest. Never wraps to a second line, never scrolls, never
 * shrinks the font, and never widens the card.
 *
 * "Whole" is the load-bearing word: a tag is either fully shown or rolled into
 * the +N, never clipped mid-label. The DS measures this in the browser; we
 * instead estimate each tag's width from its label (12px/500 renders at roughly
 * 6.6px per character, plus 18px of padding and border), which keeps the card
 * fully server-rendered - no ResizeObserver on every card in the grid. `budget`
 * is the card's content width; the default suits the ~280-320px grid card.
 */
export function TagRow({
  tags,
  max = 3,
  dense = true,
  budget = 240,
  reserveHeight = false,
}: {
  tags: string[];
  max?: number;
  dense?: boolean;
  budget?: number;
  /** Hold the row's height even with no tags, so cards in a row stay aligned. */
  reserveHeight?: boolean;
}) {
  if (!tags.length)
    return reserveHeight ? <div className="h-0 sm:h-[22px] [.ckRail_&]:h-[22px]" aria-hidden /> : null;

  const GAP = 6;
  const widthOf = (label: string) => 18 + label.length * 6.6;
  const overflowChipWidth = 34;
  const cap = Math.min(max, tags.length);

  let used = 0;
  let fit = 0;
  for (let i = 0; i < cap; i++) {
    const w = widthOf(tags[i]) + (i > 0 ? GAP : 0);
    // Reserve room for the "+N" whenever one will be needed.
    const needsOverflowChip = cap < tags.length || i < cap - 1;
    const reserve = needsOverflowChip ? GAP + overflowChipWidth : 0;
    if (used + w + reserve <= budget) {
      used += w;
      fit = i + 1;
    } else {
      break;
    }
  }
  fit = Math.max(1, fit);

  const shown = tags.slice(0, fit);
  const extra = tags.length - fit;

  return (
    <div className="flex min-w-0 gap-1.5 overflow-hidden">
      {shown.map((t) => (
        <Tag key={t} dense={dense}>
          {t}
        </Tag>
      ))}
      {extra > 0 ? (
        <Tag dense={dense} className="text-[color:var(--slate)]">
          +{extra}
        </Tag>
      ) : null}
    </div>
  );
}

/* ============================ badge ============================ */
/* STATUS ONLY, rounded rect. Almost-full → Coral · Trending/Waitlist → Amber ·
   Free/Going → Sage · New → Teal · Sold out → Slate on Mist. */

export type BadgeTone = "coral" | "amber" | "sage" | "teal" | "lavender" | "neutral" | "onImage";

const BADGE_TONE: Record<BadgeTone, CSSProperties> = {
  // Text uses the AA-safe ink of each hue - the raw status hue on its own 12-16%
  // tint is too light to read at 12px.
  coral: { background: "color-mix(in srgb, var(--coral) 12%, var(--paper))", color: "var(--coral-ink)" },
  amber: { background: "color-mix(in srgb, var(--amber) 16%, var(--paper))", color: "var(--amber-ink)" },
  sage: { background: "color-mix(in srgb, var(--sage) 14%, var(--paper))", color: "var(--sage-ink)" },
  teal: { background: "color-mix(in srgb, var(--teal) 12%, var(--paper))", color: "var(--teal)" },
  lavender: { background: "var(--lavender-100)", color: "var(--purple-700)" },
  neutral: { background: "var(--mist)", color: "var(--slate)" },
  onImage: { background: "rgba(28,24,48,.62)", color: "#fff" },
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className="ck-badge" style={BADGE_TONE[tone]}>
      {children}
    </span>
  );
}

/** The event-card status vocabulary - the ONE place colour appears on a card. */
export type EventStatus = "free" | "almostfull" | "spots" | "trending" | "new" | "waitlist" | "soldout" | "going";

const EVENT_STATUS: Record<EventStatus, { label: string; tone: BadgeTone; check?: boolean }> = {
  free: { label: "Free", tone: "sage" },
  almostfull: { label: "Almost full", tone: "coral" },
  spots: { label: "spots left", tone: "coral" },
  trending: { label: "Trending", tone: "amber" },
  new: { label: "New", tone: "teal" },
  waitlist: { label: "Waitlist", tone: "amber" },
  soldout: { label: "Sold out", tone: "neutral" },
  going: { label: "You're going", tone: "sage", check: true },
};

export function StatusBadge({ status, spotsLeft }: { status: EventStatus; spotsLeft?: number | null }) {
  const s = EVENT_STATUS[status];
  if (!s) return null;
  const label =
    status === "spots" && spotsLeft != null
      ? `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left`
      : s.label;
  return (
    <Badge tone={s.tone}>
      {s.check ? <Icon name="check" size={13} stroke={2.6} /> : null}
      {label}
    </Badge>
  );
}

/* ============================ avatar ============================ */
/* Round. No photo → a soft lavender disc with a deeper purple silhouette
   (anonymous-until-mutual reads as calm, not as a missing image). */

const AVATAR_TINTS: Array<[string, string]> = [
  ["var(--lavender-200)", "var(--purple-500)"],
  ["color-mix(in srgb, var(--lavender-200) 65%, var(--lavender-100))", "var(--purple-600)"],
  ["var(--lavender-100)", "var(--purple-400)"],
  ["color-mix(in srgb, var(--lavender-200) 35%, var(--lavender-100))", "var(--purple-500)"],
];

export function Avatar({
  name = "",
  src,
  size = 40,
  ring,
  className,
}: {
  name?: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const [bg, fg] = AVATAR_TINTS[(name.charCodeAt(0) || 0) % AVATAR_TINTS.length];
  const avatarSrc = resolveAvatarImage(src);
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flex: "none",
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: ring ? "0 0 0 2.5px var(--paper), 0 0 0 4px var(--lavender)" : undefined,
  };

  if (avatarSrc) {
    return (
      <span className={className} style={{ ...base, background: "var(--champagne-deep)" }}>
        {/* Avatars are remote (Supabase / OAuth) and tiny; next/image buys
            nothing here and its loader chokes on the arbitrary provider hosts. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarSrc} alt={name} width={size} height={size} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ ...base, background: bg }}
      role="img"
      aria-label={name ? `${name} - no photo yet` : "No photo yet"}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill={fg} aria-hidden>
        <circle cx="12" cy="8.6" r="4" />
        <path d="M4 20c0-4.2 3.6-7 8-7s8 2.8 8 7z" />
      </svg>
    </span>
  );
}

/**
 * AvatarStack - the social-proof cluster. The "+N" chip is the SAME diameter and
 * vertical centre as the avatars (never a raised superscript).
 */
export function AvatarStack({
  people,
  max = 4,
  size = 26,
  label,
}: {
  people: Array<{ name?: string; src?: string | null }>;
  max?: number;
  size?: number;
  label?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const overlap = -size * 0.34;
  return (
    <div className="inline-flex min-w-0 items-center gap-2.5">
      <div className="flex items-center">
        {shown.map((p, i) => (
          <span key={i} style={{ marginLeft: i ? overlap : 0, display: "flex", zIndex: i }}>
            <Avatar name={p.name} src={p.src} size={size} className="shadow-[0_0_0_2.5px_var(--paper)]" />
          </span>
        ))}
        {extra > 0 ? (
          <span
            className="font-display inline-flex items-center justify-center rounded-full bg-[color:var(--lavender-100)] font-bold text-[color:var(--purple-700)] shadow-[0_0_0_2.5px_var(--paper)]"
            style={{ marginLeft: overlap, width: size, height: size, flex: "none", fontSize: size * 0.34, lineHeight: 1 }}
          >
            +{extra}
          </span>
        ) : null}
      </div>
      {label ? <span className="truncate text-[13px] font-medium text-[color:var(--slate)]">{label}</span> : null}
    </div>
  );
}

/* ============================ categories ============================ */
/* The canonical 16 (source: TECH/07_INTEREST_TAGS). A category is NOT a tag -
   tags live *within* a category. Used IDENTICALLY on Discovery, Dashboard and
   Onboarding. Monochrome purple-on-lavender only: never a per-category colour. */

const CATEGORY_GLYPHS: Record<string, ReactNode> = {
  all: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h10" />
    </>
  ),
  wellness: (
    <>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </>
  ),
  food: (
    <>
      <path d="M8 22h8" />
      <path d="M7 10h10" />
      <path d="M12 15v7" />
      <path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
    </>
  ),
  arts: (
    <>
      <path d="M12 3a9 8 0 0 0 0 16 1.8 1.8 0 0 0 1.7-2.4 1.8 1.8 0 0 1 1.7-2.4H17a4 4 0 0 0 4-4 9 8 0 0 0-9-7.2Z" />
      <circle cx="8" cy="9.5" r="1" />
      <circle cx="12.5" cy="7" r="1" />
      <circle cx="16" cy="11" r="1" />
    </>
  ),
  social: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  fitness: (
    <>
      <path d="m6.5 6.5 11 11" />
      <path d="m21 21-1-1" />
      <path d="m3 3 1 1" />
      <path d="m18 22 4-4" />
      <path d="m2 6 4-4" />
      <path d="m3 10 7-7" />
      <path d="m14 21 7-7" />
    </>
  ),
  outdoors: <path d="m8 3 4 8 5-5 5 15H2L8 3z" />,
  learning: (
    <>
      <path d="M3 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-2.6H3z" />
      <path d="M21 4h-6a3 3 0 0 0-3 3v13a3 3 0 0 1 3-2.6h6z" />
    </>
  ),
  networking: (
    <>
      <rect x="2" y="7" width="20" height="13" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M2 13h20" />
    </>
  ),
  dance: (
    <>
      <path d="M9 18V5l12-2v13" />
      <path d="m9 9 12-2" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  creative: (
    <>
      <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v5a9 9 0 0 1-16 0V5Z" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
      <path d="M8.5 13a4 4 0 0 0 7 0" />
    </>
  ),
  lifestyle: (
    <>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
      <path d="M19 4v3" />
      <path d="M20.5 5.5h-3" />
      <path d="M5 17v2" />
      <path d="M6 18H4" />
    </>
  ),
  community: (
    <>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </>
  ),
  travel: (
    <>
      <path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </>
  ),
  family: (
    <>
      <path d="M9 12h.01" />
      <path d="M15 12h.01" />
      <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
      <path d="M17.6 7.6a9 9 0 0 1 3 4 1.8 1.8 0 0 1 0 1.6 9 9 0 0 1-17.2 0 1.8 1.8 0 0 1 0-1.6A9 9 0 0 1 12 3c1.6 0 3 .7 3 2s-.8 2-1.8 2c-.7 0-1.2-.4-1.2-.9" />
    </>
  ),
  dating: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  // Not in the canonical 16, but our live catalogue carries them - drawn in the
  // same monochrome line voice so the strip stays one treatment.
  games: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.1" />
      <circle cx="15.5" cy="15.5" r="1.1" />
      <circle cx="15.5" cy="8.5" r="1.1" />
      <circle cx="8.5" cy="15.5" r="1.1" />
    </>
  ),
  sports: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21" />
      <circle cx="12" cy="12" r="4.5" />
    </>
  ),
};

/**
 * Our live catalogue's categories are not (yet) the DS's canonical 16, so map
 * each to the closest glyph. The DS rule this preserves is the one that matters
 * visually: ONE treatment, a purple line glyph on a lavender disc - never an
 * emoji, never a per-category colour.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  relationships: "dating",
  career: "networking",
  nightlife: "music",
  "food & drink": "food",
  "arts & crafts": "arts",
  "fitness & sport": "fitness",
};

export function categoryGlyphKey(category: string): string {
  const k = category.trim().toLowerCase();
  return CATEGORY_ALIASES[k] ?? (k in CATEGORY_GLYPHS ? k : "all");
}

/** The 16, in canonical display order. `gated` = Dating: shown only to viewers
 *  whose intent includes "open to dating"; never to a friends-only viewer. */
export const CATEGORIES: Array<{ key: string; label: string; gated?: boolean }> = [
  { key: "wellness", label: "Wellness" },
  { key: "food", label: "Food & Drink" },
  { key: "arts", label: "Arts & Crafts" },
  { key: "social", label: "Social" },
  { key: "music", label: "Music" },
  { key: "fitness", label: "Fitness & Sport" },
  { key: "outdoors", label: "Outdoors" },
  { key: "learning", label: "Learning" },
  { key: "networking", label: "Networking" },
  { key: "dance", label: "Dance" },
  { key: "creative", label: "Creative" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "community", label: "Community" },
  { key: "travel", label: "Travel" },
  { key: "family", label: "Family" },
  { key: "dating", label: "Dating", gated: true },
];

export function CatGlyph({ name, size = 22, stroke = 1.75 }: { name: string; size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flex: "none" }}
    >
      {CATEGORY_GLYPHS[name] ?? CATEGORY_GLYPHS.all}
    </svg>
  );
}

/**
 * CategoryCircle - the ONE category treatment, identical on every surface:
 * a Deep-Purple line glyph on a soft lavender disc; selected fills Deep Purple
 * and reverses the glyph to cream. Selection is ALWAYS purple, never a status
 * colour. 48px mobile / 56px desktop, tap target >= 44.
 */
export function CategoryCircle({ name, label, active }: { name: string; label: string; active?: boolean }) {
  return (
    <span className="flex w-[78px] shrink-0 flex-col items-center gap-1.5 sm:w-[88px]">
      <span
        className={`flex size-12 items-center justify-center rounded-full transition-colors sm:size-14 ${
          active
            ? "bg-[color:var(--purple)] text-[color:var(--champagne)]"
            : "bg-[color-mix(in_srgb,var(--lavender)_18%,var(--champagne))] text-[color:var(--purple)] group-hover:bg-[color-mix(in_srgb,var(--lavender)_32%,var(--champagne))]"
        }`}
      >
        <CatGlyph name={name} size={23} />
      </span>
      <span
        className={`text-center text-xs leading-tight ${
          active ? "font-semibold text-[color:var(--purple-700)]" : "font-medium text-[color:var(--ink-soft)]"
        }`}
      >
        {label}
      </span>
    </span>
  );
}

/* ============================ commonality line ============================ */
/**
 * The People Card's hook line. It carries a NON-interest axis on purpose, so it
 * can never just restate the interest tags below it. Priority: shared event →
 * shared music → (post-mutual only) a light life tag → proximity → omit.
 * Life tags are private until mutual, so pre-mutual surfaces never surface them.
 */
export type Commonality =
  | { kind: "event"; term: string }
  | { kind: "music"; term: string }
  | { kind: "life"; term: string }
  | { kind: "proximity"; term: string };

export function commonality(
  p: { sharedEvent?: string | null; sharedMusic?: string | null; commonLife?: string | null; proximity?: string | null },
  postMutual = false,
): Commonality | null {
  if (p.sharedEvent) return { kind: "event", term: p.sharedEvent };
  if (p.sharedMusic) return { kind: "music", term: p.sharedMusic };
  if (postMutual && p.commonLife) return { kind: "life", term: p.commonLife };
  if (p.proximity) return { kind: "proximity", term: p.proximity };
  return null;
}

function VennGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--purple-500)" strokeWidth="1.8" strokeLinecap="round" aria-hidden style={{ flex: "none", marginTop: 1 }}>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </svg>
  );
}

export function CommonalityLine({ c }: { c: Commonality | null }) {
  if (!c) return null;
  const lead = c.kind === "event" ? "You were both at " : c.kind === "music" ? "Both into " : "";
  return (
    <p className="flex items-start gap-[7px] text-[12.5px] leading-[1.4] text-[color:var(--ink-soft)]">
      {c.kind === "event" ? (
        <Icon name="pin" size={14} className="mt-px text-[color:var(--purple-500)]" />
      ) : c.kind === "music" ? (
        <Icon name="music" size={14} className="mt-px text-[color:var(--purple-500)]" />
      ) : (
        <VennGlyph />
      )}
      <span className="min-w-0">
        {lead}
        <b className="font-semibold text-[color:var(--ink)]">{c.term}</b>
      </span>
    </p>
  );
}
