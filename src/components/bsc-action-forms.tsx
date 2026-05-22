"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

type State = "idle" | "submitting" | "success" | "error";

function useSubmitMessage() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  return { state, setState, message, setMessage };
}

async function parseResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Action failed.");
  return payload;
}

export function BscProfileForm({
  initial,
}: {
  initial?: {
    displayName?: string | null;
    bio?: string | null;
    suburb?: string | null;
    city?: string | null;
    postcode?: string | null;
    church?: string | null;
    denomination?: string | null;
    faithBackground?: string | null;
    prayerFocus?: string | null;
    willingToHost?: boolean;
    willingToLead?: boolean;
    meetingPreference?: string;
    privacy?: string;
    ageVerified?: boolean;
  };
}) {
  const router = useRouter();
  const { state, setState, message, setMessage } = useSubmitMessage();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const body = {
      displayName: String(form.get("displayName") || ""),
      bio: String(form.get("bio") || ""),
      suburb: String(form.get("suburb") || ""),
      city: String(form.get("city") || ""),
      postcode: String(form.get("postcode") || ""),
      church: String(form.get("church") || ""),
      denomination: String(form.get("denomination") || ""),
      faithBackground: String(form.get("faithBackground") || ""),
      prayerFocus: String(form.get("prayerFocus") || ""),
      willingToHost: form.get("willingToHost") === "on",
      willingToLead: form.get("willingToLead") === "on",
      meetingPreference: String(form.get("meetingPreference") || "both"),
      privacy: String(form.get("privacy") || "public"),
      ageVerified: form.get("ageVerified") === "on",
    };
    try {
      await parseResponse(
        await fetch("/api/bsc/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      setState("success");
      setMessage("Profile saved.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Profile could not be saved.");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <TextInput name="displayName" label="Display name" defaultValue={initial?.displayName ?? ""} required />
      <TextArea name="bio" label="Bio" defaultValue={initial?.bio ?? ""} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput name="suburb" label="Suburb" defaultValue={initial?.suburb ?? ""} />
        <TextInput name="city" label="City" defaultValue={initial?.city ?? ""} />
        <TextInput name="postcode" label="Postcode" defaultValue={initial?.postcode ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="church" label="Church" defaultValue={initial?.church ?? ""} />
        <TextInput name="denomination" label="Denomination" defaultValue={initial?.denomination ?? ""} />
      </div>
      <TextArea name="faithBackground" label="Faith background" defaultValue={initial?.faithBackground ?? ""} />
      <TextArea name="prayerFocus" label="Prayer focus" defaultValue={initial?.prayerFocus ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          name="meetingPreference"
          label="Meeting preference"
          defaultValue={initial?.meetingPreference ?? "both"}
          options={[
            ["in_person", "In person"],
            ["online", "Online"],
            ["both", "Both"],
          ]}
        />
        <Select
          name="privacy"
          label="Profile privacy"
          defaultValue={initial?.privacy ?? "public"}
          options={[
            ["public", "Public"],
            ["private", "Private"],
          ]}
        />
      </div>
      <label className="flex items-center gap-3 rounded-xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] px-4 py-3 text-sm font-bold">
        <input name="ageVerified" type="checkbox" defaultChecked={initial?.ageVerified} />
        I confirm I meet the minimum age requirement for community features.
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Check name="willingToHost" label="Willing to host" defaultChecked={initial?.willingToHost} />
        <Check name="willingToLead" label="Willing to lead" defaultChecked={initial?.willingToLead} />
      </div>
      <Submit state={state}>Save profile</Submit>
      <Status state={state} message={message} />
    </form>
  );
}

export function BscGroupForm() {
  const router = useRouter();
  const { state, setState, message, setMessage } = useSubmitMessage();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    const form = new FormData(event.currentTarget);
    const body = {
      name: String(form.get("name") || ""),
      description: String(form.get("description") || ""),
      meetingType: String(form.get("meetingType") || "both"),
      visibility: String(form.get("visibility") || "public"),
      suburb: String(form.get("suburb") || ""),
      city: String(form.get("city") || ""),
      postcode: String(form.get("postcode") || ""),
      schedule: String(form.get("schedule") || ""),
      dayOfWeek: String(form.get("dayOfWeek") || ""),
      ageGroup: String(form.get("ageGroup") || ""),
      denomination: String(form.get("denomination") || ""),
      tags: String(form.get("tags") || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    try {
      await parseResponse(
        await fetch("/api/bsc/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      setState("success");
      setMessage("Group created.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Group could not be created.");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <TextInput name="name" label="Group name" required />
      <TextArea name="description" label="Description" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="meetingType" label="Meeting type" defaultValue="both" options={[["in_person", "In person"], ["online", "Online"], ["both", "Both"]]} />
        <Select name="visibility" label="Visibility" defaultValue="public" options={[["public", "Public"], ["private", "Private"]]} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput name="suburb" label="Suburb" />
        <TextInput name="city" label="City" defaultValue="Sydney" />
        <TextInput name="postcode" label="Postcode" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="schedule" label="Schedule" placeholder="Thursday evenings" />
        <TextInput name="dayOfWeek" label="Day of week" placeholder="Thursday" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="ageGroup" label="Age group" placeholder="25-40" />
        <TextInput name="denomination" label="Denomination" />
      </div>
      <TextInput name="tags" label="Tags" placeholder="Romans, Prayer, New believers" />
      <Submit state={state}>Create group</Submit>
      <Status state={state} message={message} />
    </form>
  );
}

export function BscPrayerForm() {
  return <SimplePostForm endpoint="/api/bsc/prayers" titleLabel="Title" contentLabel="Prayer or praise" submitLabel="Post" fields={<Select name="kind" label="Type" defaultValue="prayer" options={[["prayer", "Prayer request"], ["praise", "Praise report"]]} />} />;
}

export function BscTestimonyForm() {
  return <SimplePostForm endpoint="/api/bsc/testimonies" titleLabel="Title" contentLabel="Testimony" submitLabel="Submit for approval" fields={<Select name="displayMode" label="Display name" defaultValue="first_name" options={[["anonymous", "Anonymous"], ["first_name", "First name only"], ["full_name", "Full name"]]} />} />;
}

export function BscWaitlistForm() {
  const extra = (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput name="suburb" label="Suburb" required />
        <TextInput name="city" label="City" defaultValue="Sydney" required />
        <TextInput name="postcode" label="Postcode" />
      </div>
      <TextInput name="availability" label="Availability" placeholder="Weeknights, Sunday afternoon" />
      <div className="grid gap-2 sm:grid-cols-2">
        <Check name="willingToHost" label="Willing to host" />
        <Check name="willingToLead" label="Willing to lead" />
      </div>
    </>
  );
  return <SimplePostForm endpoint="/api/bsc/waitlist" titleLabel="Radius km" contentLabel="Preferences" submitLabel="Join waitlist" fields={extra} hideDefaultTitle defaultTitle="10" />;
}

function SimplePostForm({
  endpoint,
  titleLabel,
  contentLabel,
  submitLabel,
  fields,
  hideDefaultTitle = false,
  defaultTitle = "",
}: {
  endpoint: string;
  titleLabel: string;
  contentLabel: string;
  submitLabel: string;
  fields?: ReactNode;
  hideDefaultTitle?: boolean;
  defaultTitle?: string;
}) {
  const router = useRouter();
  const { state, setState, message, setMessage } = useSubmitMessage();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      await parseResponse(
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      setState("success");
      setMessage("Saved.");
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not save.");
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      {fields}
      {hideDefaultTitle ? (
        <input type="hidden" name="radiusKm" value={defaultTitle} />
      ) : (
        <TextInput name="title" label={titleLabel} required />
      )}
      <TextArea name="content" label={contentLabel} required={!hideDefaultTitle} />
      <Submit state={state}>{submitLabel}</Submit>
      <Status state={state} message={message} />
    </form>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--mauve)]">{label}</span>
      <input {...rest} className="rounded-xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] px-4 py-3 text-sm font-semibold outline-none" />
    </label>
  );
}

function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--mauve)]">{label}</span>
      <textarea {...rest} rows={4} className="rounded-xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] px-4 py-3 text-sm font-semibold outline-none" />
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--mauve)]">{label}</span>
      <select name={name} defaultValue={defaultValue} className="rounded-xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] px-4 py-3 text-sm font-semibold outline-none">
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] px-4 py-3 text-sm font-bold">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

function Submit({ state, children }: { state: State; children: ReactNode }) {
  return (
    <button type="submit" disabled={state === "submitting"} className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-bold text-[color:var(--champagne)] disabled:opacity-60">
      {state === "submitting" ? "Saving" : children}
    </button>
  );
}

function Status({ state, message }: { state: State; message: string }) {
  if (!message) return null;
  return (
    <p className={`text-sm font-bold ${state === "error" ? "text-red-700" : "text-[color:var(--mauve)]"}`}>
      {message}
    </p>
  );
}
