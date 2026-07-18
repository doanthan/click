"use client";

import { useRef, useState } from "react";

// Client half of /images. Fires N concurrent POSTs to /api/generate and
// renders the data-URL results in a grid with per-image download.

const SHOTS = [
  { value: "crowd", label: "Crowd" },
  { value: "dj", label: "DJ" },
  { value: "friends", label: "Friends" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "detail", label: "Detail (no faces)" },
] as const;

const EVENT_GROUPS: { label: string; options: [string, string][] }[] = [
  {
    label: "Parties & nightlife",
    options: [
      ["house_party", "House party"],
      ["beer_garden", "Beer garden"],
      ["warehouse", "Warehouse party"],
      ["rooftop", "Rooftop party"],
      ["festival", "Park festival"],
    ],
  },
  {
    label: "Sport & active",
    options: [
      ["pickleball", "Pickleball mixer"],
      ["beach_volleyball", "Beach volleyball"],
      ["run_club", "Run club"],
      ["bouldering", "Bouldering social"],
    ],
  },
  {
    label: "Activities & classes",
    options: [
      ["darts", "Darts night"],
      ["pottery", "Pottery class"],
      ["cooking_class", "Cooking class"],
    ],
  },
  {
    label: "Food & drink",
    options: [
      ["date_night", "Date night"],
      ["wine_bar", "Wine bar"],
      ["trivia", "Trivia night"],
      ["picnic", "Picnic mixer"],
      ["coffee", "Coffee meetup"],
    ],
  },
  {
    label: "Beach hangs",
    options: [
      ["bondi", "Bondi Beach"],
      ["coastal_walk", "Coastal walk"],
    ],
  },
];

const CAMERAS = [
  { value: "retro", label: "Retro (35mm film)" },
  { value: "y2k", label: "Y2K (disposable)" },
  { value: "ugc", label: "UGC (phone)" },
  { value: "street", label: "Street" },
  { value: "editorial", label: "Editorial" },
  { value: "moody", label: "Moody" },
  { value: "bright", label: "Bright" },
] as const;

const ASPECT_CSS: Record<string, string> = {
  "1:1": "1 / 1",
  "4:5": "4 / 5",
  "3:2": "3 / 2",
};

type Result = {
  id: string;
  status: "loading" | "done" | "error";
  url?: string;
  error?: string;
  aspect: string;
  label: string;
};

const fieldLabelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[color:var(--slate)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      {children}
    </label>
  );
}

// For Segmented button groups: a <label> wrapper would make the caption
// synthetically click the group's first button (buttons are labelable).
function GroupField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <span className={fieldLabelClass}>{label}</span>
      {children}
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[] | { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={
              "rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors " +
              (selected
                ? "border-transparent bg-[color:var(--purple)] text-white"
                : "border-[color:var(--mist)] bg-white text-[color:var(--ink)] hover:border-[color:var(--slate)]")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const selectClass =
  "w-full rounded-xl border border-[color:var(--mist)] bg-white px-3 py-2 text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--purple)]";
const textareaClass = selectClass + " resize-y";

export default function ImageStudio() {
  const [shot, setShot] = useState("crowd");
  const [event, setEvent] = useState("bondi");
  const [customEvent, setCustomEvent] = useState("");
  const [light, setLight] = useState("golden_hour");
  const [group, setGroup] = useState("small_group");
  const [camera, setCamera] = useState("retro");
  const [vibe, setVibe] = useState("");
  const [extra, setExtra] = useState("");
  const [aspect, setAspect] = useState("4:5");
  const [count, setCount] = useState(2);
  const [model, setModel] = useState("flash");
  const [results, setResults] = useState<Result[]>([]);
  const batchRef = useRef(0);

  const customActive = customEvent.trim().length > 0;
  const eventLabel = customActive
    ? "custom"
    : EVENT_GROUPS.flatMap((g) => g.options).find(([k]) => k === event)?.[1] ?? event;

  function patch(id: string, update: Partial<Result>) {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...update } : r)));
  }

  function generate() {
    const options = { shot, event, customEvent, light, group, camera, vibe, extra, aspect, model };
    const batch = ++batchRef.current;
    const slots: Result[] = Array.from({ length: count }, (_, i) => ({
      id: `${batch}-${i}`,
      status: "loading",
      aspect,
      label: `${eventLabel} ${shot}`,
    }));
    setResults((prev) => [...slots, ...prev]);

    for (const slot of slots) {
      fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
          patch(slot.id, { status: "done", url: data.image });
        })
        .catch((err: Error) => {
          patch(slot.id, { status: "error", error: err.message });
        });
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      <section className="space-y-4 rounded-2xl border border-[color:var(--mist)] bg-white p-5 shadow-sm lg:sticky lg:top-6">
        <Field label="Shot type">
          <select value={shot} onChange={(e) => setShot(e.target.value)} className={selectClass}>
            {SHOTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Event">
          <select
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            disabled={customActive}
            className={selectClass + (customActive ? " opacity-40" : "")}
          >
            {EVENT_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field label="Custom event (overrides the picker)">
          <input
            type="text"
            value={customEvent}
            onChange={(e) => setCustomEvent(e.target.value)}
            maxLength={200}
            placeholder="e.g. a salsa class in a Newtown hall"
            className={selectClass}
          />
        </Field>

        <GroupField label="Light">
          <Segmented
            value={light}
            onChange={setLight}
            options={[
              { value: "golden_hour", label: "Golden hour" },
              { value: "night_flash", label: "Night flash" },
            ]}
          />
        </GroupField>

        <GroupField label="Casting">
          <Segmented
            value={group}
            onChange={setGroup}
            options={[
              { value: "pair", label: "Pair" },
              { value: "small_group", label: "Small group" },
              { value: "crowd", label: "Crowd" },
            ]}
          />
        </GroupField>

        <Field label="Camera">
          <select value={camera} onChange={(e) => setCamera(e.target.value)} className={selectClass}>
            {CAMERAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Vibe (styling flavour)">
          <textarea
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="e.g. matching red heart sunglasses"
            className={textareaClass}
          />
        </Field>

        <Field label="Extra direction">
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            maxLength={600}
            rows={2}
            className={textareaClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <GroupField label="Aspect">
            <Segmented
              value={aspect}
              onChange={setAspect}
              options={[
                { value: "1:1", label: "1:1" },
                { value: "4:5", label: "4:5" },
                { value: "3:2", label: "3:2" },
              ]}
            />
          </GroupField>
          <GroupField label="Count">
            <Segmented
              value={String(count)}
              onChange={(v) => setCount(Number(v))}
              options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
            />
          </GroupField>
        </div>

        <GroupField label="Model">
          <Segmented
            value={model}
            onChange={setModel}
            options={[
              { value: "flash", label: "Flash (fast)" },
              { value: "pro", label: "Pro (slower)" },
            ]}
          />
        </GroupField>

        <button type="button" onClick={generate} className="ck-btn ck-btn--primary ck-btn--md ck-btn--full">
          Generate {count > 1 ? `${count} images` : "image"}
        </button>
      </section>

      <section>
        {results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--mist-strong)] bg-[color:var(--champagne-deep)] p-10 text-center text-sm text-[color:var(--slate)]">
            No images yet - tune the controls and select Generate.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {results.map((r) => (
              <figure
                key={r.id}
                className="overflow-hidden rounded-2xl border border-[color:var(--mist)] bg-white shadow-sm"
              >
                <div
                  className="relative w-full bg-[color:var(--mist)]"
                  style={{ aspectRatio: ASPECT_CSS[r.aspect] ?? "4 / 5" }}
                >
                  {r.status === "loading" && (
                    <div className="absolute inset-0 animate-pulse bg-[color:var(--lav-bg)]" />
                  )}
                  {r.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-[color:var(--danger)]">
                      {r.error}
                    </div>
                  )}
                  {r.status === "done" && r.url && (
                    // eslint-disable-next-line @next/next/no-img-element -- data URL, next/image adds nothing
                    <img src={r.url} alt={r.label} className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </div>
                <figcaption className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="truncate text-xs text-[color:var(--slate)]">{r.label}</span>
                  {r.status === "done" && r.url && (
                    <a
                      href={r.url}
                      download={`click-${r.label.replace(/\s+/g, "-")}-${r.id}.png`}
                      className="shrink-0 text-xs font-semibold text-[color:var(--purple)] hover:underline"
                    >
                      Download
                    </a>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
