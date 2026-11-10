"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  joinHostWaitlistAction,
  type HostWaitlistState,
  type HostWaitlistValues,
} from "@/app/host-waitlist/actions";
import { HOST_EVENT_TYPES } from "@/lib/host-event-types";
import { FormField, Icon } from "./ds";
import { SubmitButton } from "./ds-client";

const IDLE: HostWaitlistState = { status: "idle" };

const EMPTY: HostWaitlistValues = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  place: "",
  website: "",
  eventTypes: [],
};

/**
 * The homepage host waitlist: a business or person who'd like to host on Click
 * leaves their details. Only the business name and email are required. The
 * instant-access signup at /merchant/signup is separate and stays linked from
 * the page's closing band.
 */
export function HostWaitlistForm() {
  const [state, formAction] = useActionState(joinHostWaitlistAction, IDLE);
  // The ticked categories live in state, not in the inputs, so they survive the
  // form reset React does after every action - text fields get theirs back
  // from `values` below.
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());

  if (state.status === "done") return <HostWaitlistJoined area={state.area} />;

  const values = state.status === "error" ? state.values : EMPTY;
  const errors = state.status === "error" ? state.fieldErrors : {};

  function toggle(key: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <form action={formAction} noValidate className="grid gap-4">
      {/* Bot trap: off-screen, out of the tab order and the accessibility tree.
          A person never fills it; the action drops any request that does,
          without saying so. Same name as the /waitlist trap. */}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Leave this empty
          <input type="text" name="leave_blank" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="host-business"
          label="Business or venue name"
          name="businessName"
          autoComplete="organization"
          placeholder="Marrickville Clay Studio"
          maxLength={120}
          required
          defaultValue={values.businessName}
          error={errors.businessName}
        />
        <FormField
          id="host-name"
          label="Your name"
          name="contactName"
          autoComplete="name"
          placeholder="First name is fine"
          maxLength={80}
          defaultValue={values.contactName}
          error={errors.contactName}
        />
        <FormField
          id="host-email"
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          required
          defaultValue={values.email}
          error={errors.email}
        />
        <FormField
          id="host-phone"
          label="Phone"
          type="tel"
          name="phone"
          autoComplete="tel"
          inputMode="tel"
          placeholder="0412 345 678"
          maxLength={24}
          defaultValue={values.phone}
          error={errors.phone}
        />
        <FormField
          id="host-place"
          label="Where you host"
          name="place"
          autoComplete="postal-code"
          placeholder="Suburb or postcode"
          maxLength={80}
          defaultValue={values.place}
          error={errors.place}
        />
        <FormField
          id="host-website"
          label="Website or Instagram"
          name="website"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="@yourvenue"
          maxLength={200}
          defaultValue={values.website}
          error={errors.website}
        />
      </div>

      <fieldset className="grid gap-2.5">
        <legend className="mb-2.5 text-[13.5px] font-semibold text-[color:var(--ink)]">
          What would you host?{" "}
          <span className="font-normal text-[color:var(--slate)]">Pick any that fit.</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {HOST_EVENT_TYPES.map((type) => {
            const selected = picked.has(type.key);
            return (
              <button
                key={type.key}
                type="button"
                onClick={() => toggle(type.key)}
                aria-pressed={selected}
                className={`ck-tag ck-tag--select ck-tag--tap touch-manipulation ${selected ? "ck-tag--selected" : ""}`}
              >
                {type.label}
              </button>
            );
          })}
        </div>
        {HOST_EVENT_TYPES.filter((type) => picked.has(type.key)).map((type) => (
          <input key={type.key} type="hidden" name="eventTypes" value={type.key} />
        ))}
      </fieldset>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-[13.5px] font-medium text-[color:var(--danger)]">
          {state.message}
        </p>
      ) : null}

      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <SubmitButton size="lg" pendingLabel="Sending..." className="w-full sm:w-auto">
          Join the host waitlist
        </SubmitButton>
        <p className="text-[13px] leading-[1.5] text-[color:var(--slate)]">
          We only use these details to get in touch about hosting.
        </p>
      </div>
    </form>
  );
}

function HostWaitlistJoined({ area }: { area: string | null }) {
  // The form that had focus is gone; land keyboard and screen-reader users on
  // the outcome rather than at the top of the document.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="rise-soft">
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--sage)_16%,white)] text-[color:var(--sage-ink)]"
      >
        <Icon name="check" size={24} stroke={2.4} />
      </span>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="font-display mt-4 text-[length:var(--text-h2)] leading-tight font-semibold tracking-[-0.015em] text-[color:var(--ink)] outline-none"
      >
        You&apos;re on the host list.
      </h3>
      {/* No "check your inbox": a repeat address gets this same screen and no
          email, so promising one would be wrong half the time. */}
      <p className="mt-2 max-w-[440px] text-base leading-[1.6] text-[color:var(--slate)]">
        {area === "outside"
          ? "Click opens in Sydney first - we'll tell you the moment it reaches you."
          : "We'll be in touch before bookings open to hear more about what you run."}
      </p>
    </div>
  );
}
