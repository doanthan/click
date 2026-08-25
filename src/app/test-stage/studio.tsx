"use client";

import { useMemo, useRef, useState } from "react";

type Mode = "paired" | "hero" | "closer";
type Placement = "hero" | "closer";
type ImageStatus = "loading" | "done" | "error";

type ImageResult = {
  status: ImageStatus;
  aspect: string;
  url?: string;
  error?: string;
};

type WorldResult = {
  id: string;
  title: string;
  worldLabel: string;
  hero?: ImageResult;
  closer?: ImageResult;
};

const MODES = [
  { value: "paired", label: "Hero + bottom" },
  { value: "hero", label: "Hero only" },
  { value: "closer", label: "Bottom only" },
] as const;

const WORLD_OPTIONS = [
  { value: "surprise", label: "Surprise me" },
  { value: "electric_aperitivo", label: "Electric aperitivo" },
  { value: "poolside_citrus", label: "Poolside citrus" },
  { value: "greenhouse_after_rain", label: "Greenhouse after rain" },
  { value: "midnight_supper", label: "Midnight supper" },
  { value: "paper_theatre", label: "Paper theatre" },
  { value: "custom", label: "Custom world" },
] as const;

const SURPRISE_WORLDS = WORLD_OPTIONS.filter(
  (option) => option.value !== "surprise" && option.value !== "custom",
);

const ANCHORS = [
  { value: "glassware", label: "Glassware" },
  { value: "serving_ritual", label: "Serving ritual" },
  { value: "atmosphere", label: "Atmosphere only" },
  { value: "product_cameo", label: "Product cameo" },
  { value: "product_hero", label: "Product lead" },
] as const;

const COMPOSITIONS = [
  { value: "weightless_tabletop", label: "Weightless tabletop" },
  { value: "orbital_drift", label: "Orbital drift" },
  { value: "ingredient_constellation", label: "Ingredient constellation" },
  { value: "suspended_splash", label: "Suspended splash" },
  { value: "seasonal_shower", label: "Seasonal shower" },
  { value: "macro_passage", label: "Macro passage" },
] as const;

const COMPOSITION_NOTES: Record<string, string> = {
  weightless_tabletop: "A real surface anchors the scene while one moment lifts.",
  orbital_drift: "Two main objects curve around the protected copy area.",
  ingredient_constellation: "Three to five sensory objects sit at varied depths.",
  suspended_splash: "One coherent liquid gesture supplies the energy.",
  seasonal_shower: "Peel, leaves or petals enter from one direction.",
  macro_passage: "One oversized object crosses an edge with smaller depth cues.",
};

const COPY_ZONES = [
  { value: "left", label: "Left" },
  { value: "centre", label: "Centre" },
  { value: "right", label: "Right" },
] as const;

const ENERGIES = [
  { value: "quiet", label: "Quiet" },
  { value: "playful", label: "Playful" },
  { value: "electric", label: "Electric" },
  { value: "surreal", label: "Surreal" },
] as const;

const FIELDS = [
  { value: "light", label: "Light field" },
  { value: "dark", label: "Dark field" },
] as const;

const MODELS = [
  { value: "flash", label: "Flash" },
  { value: "pro", label: "Pro" },
] as const;

const labelClass = "mb-2 block text-sm font-semibold text-[color:var(--ink)]";
const helperClass = "mt-1.5 text-xs leading-5 text-[color:var(--slate)]";

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {helper ? <span className={helperClass}>{helper}</span> : null}
    </label>
  );
}

function GroupField({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label}>
      <span className={labelClass}>{label}</span>
      {children}
      {helper ? <p className={helperClass}>{helper}</p> : null}
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`ck-tag ck-tag--tap ck-tag--select ${selected ? "ck-tag--selected" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read that image."));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

function randomWorld() {
  return SURPRISE_WORLDS[Math.floor(Math.random() * SURPRISE_WORLDS.length)];
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export default function StageStudio() {
  const [mode, setMode] = useState<Mode>("paired");
  const [concept, setConcept] = useState(
    "A bright new-world wine launch that feels curious, social and a little unexpected",
  );
  const [world, setWorld] = useState("surprise");
  const [anchor, setAnchor] = useState("glassware");
  const [composition, setComposition] = useState("weightless_tabletop");
  const [copyZone, setCopyZone] = useState("centre");
  const [energy, setEnergy] = useState("playful");
  const [field, setField] = useState("light");
  const [ingredients, setIngredients] = useState(
    "wine-red reflections, a twist of grapefruit peel, condensation, clear ice",
  );
  const [palette, setPalette] = useState("cobalt, coral, clear glass and cool silver");
  const [productDescription, setProductDescription] = useState("");
  const [extra, setExtra] = useState("");
  const [count, setCount] = useState(1);
  const [model, setModel] = useState("flash");
  const [productFile, setProductFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [results, setResults] = useState<WorldResult[]>([]);
  const batchRef = useRef(0);

  const generating = results.some(
    (result) => result.hero?.status === "loading" || result.closer?.status === "loading",
  );
  const productMode = anchor === "product_cameo" || anchor === "product_hero";
  const actionLabel = useMemo(() => {
    const noun = mode === "paired" ? "world" : "image";
    return `Generate ${count} ${noun}${count > 1 ? "s" : ""}`;
  }, [count, mode]);

  function patch(
    id: string,
    placement: Placement,
    update: Partial<ImageResult>,
  ) {
    setResults((previous) =>
      previous.map((result) => {
        const current = result[placement];
        if (result.id !== id || !current) return result;
        return {
          ...result,
          [placement]: { ...current, ...update },
        };
      }),
    );
  }

  async function requestImage(
    placement: Placement,
    resolvedWorld: string,
    productReference?: string,
    worldReference?: string,
  ) {
    const response = await fetch("/api/generate-stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placement,
        concept,
        world: resolvedWorld,
        anchor,
        composition,
        copyZone,
        energy,
        field,
        ingredients,
        palette,
        productDescription,
        extra,
        model,
        productReference,
        worldReference,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    if (typeof data.image !== "string") {
      throw new Error("The generator returned an unreadable image.");
    }
    return data.image as string;
  }

  async function runWorld(
    slot: WorldResult,
    resolvedWorld: string,
    productReference?: string,
  ) {
    if (mode === "closer") {
      try {
        const image = await requestImage("closer", resolvedWorld, productReference);
        patch(slot.id, "closer", { status: "done", url: image });
      } catch (error) {
        patch(slot.id, "closer", {
          status: "error",
          error: error instanceof Error ? error.message : "Generation failed.",
        });
      }
      return;
    }

    let heroImage: string;
    try {
      heroImage = await requestImage("hero", resolvedWorld, productReference);
      patch(slot.id, "hero", { status: "done", url: heroImage });
    } catch (error) {
      patch(slot.id, "hero", {
        status: "error",
        error: error instanceof Error ? error.message : "Generation failed.",
      });
      if (mode === "paired") {
        patch(slot.id, "closer", {
          status: "error",
          error: "The paired hero failed, so the bottom image was not started.",
        });
      }
      return;
    }

    if (mode === "hero") return;

    try {
      const closerImage = await requestImage(
        "closer",
        resolvedWorld,
        productReference,
        heroImage,
      );
      patch(slot.id, "closer", { status: "done", url: closerImage });
    } catch (error) {
      patch(slot.id, "closer", {
        status: "error",
        error: error instanceof Error ? error.message : "Generation failed.",
      });
    }
  }

  async function generate() {
    setFileError("");
    let productReference: string | undefined;
    if (productMode && productFile) {
      if (productFile.size > 8 * 1024 * 1024) {
        setFileError("Use a JPG, PNG or WebP under 8 MB.");
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(productFile.type)) {
        setFileError("Use a JPG, PNG or WebP reference.");
        return;
      }
      try {
        productReference = await readFileAsDataUrl(productFile);
      } catch (error) {
        setFileError(error instanceof Error ? error.message : "Could not read that image.");
        return;
      }
    }

    const batch = ++batchRef.current;
    const prepared = Array.from({ length: count }, (_, index) => {
      const resolved = world === "surprise" ? randomWorld() : WORLD_OPTIONS.find((item) => item.value === world);
      const resolvedWorld = resolved?.value ?? "custom";
      const worldLabel = resolved?.label ?? "Custom world";
      const slot: WorldResult = {
        id: `${batch}-${index}`,
        title: concept.trim() || "Untitled campaign world",
        worldLabel,
        hero:
          mode === "paired" || mode === "hero"
            ? { status: "loading", aspect: "4 / 5" }
            : undefined,
        closer:
          mode === "paired" || mode === "closer"
            ? { status: "loading", aspect: "3 / 2" }
            : undefined,
      };
      return { slot, resolvedWorld };
    });

    setResults((previous) => [...prepared.map((item) => item.slot), ...previous]);
    await Promise.all(
      prepared.map(({ slot, resolvedWorld }) =>
        runWorld(slot, resolvedWorld, productReference),
      ),
    );
  }

  return (
    <div className="mt-9 grid gap-7 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
      <section className="rounded-2xl bg-white p-5 shadow-[0_12px_30px_-18px_rgba(28,24,48,0.28)] sm:p-6 lg:sticky lg:top-6">
        <div className="space-y-6">
          <GroupField
            label="Output"
            helper="Paired mode uses the hero as a visual reference for the bottom image."
          >
            <Segmented value={mode} onChange={(value) => setMode(value as Mode)} options={MODES} />
          </GroupField>

          <Field label="Campaign concept" helper="Describe the email idea, offer or occasion in plain language.">
            <textarea
              value={concept}
              onChange={(event) => setConcept(event.target.value)}
              maxLength={500}
              rows={4}
              className="ck-input ck-input--area w-full"
            />
          </Field>

          <div className="grid gap-4 border-t border-[color:var(--mist)] pt-6">
            <Field label="World direction">
              <select
                value={world}
                onChange={(event) => setWorld(event.target.value)}
                className="ck-input w-full"
              >
                {WORLD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Visual anchor">
              <select
                value={anchor}
                onChange={(event) => setAnchor(event.target.value)}
                className="ck-input w-full"
              >
                {ANCHORS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Composition" helper={COMPOSITION_NOTES[composition]}>
              <select
                value={composition}
                onChange={(event) => setComposition(event.target.value)}
                className="ck-input w-full"
              >
                {COMPOSITIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-5 border-t border-[color:var(--mist)] pt-6">
            <GroupField label="Copy zone">
              <Segmented value={copyZone} onChange={setCopyZone} options={COPY_ZONES} />
            </GroupField>
            <GroupField label="Energy">
              <Segmented value={energy} onChange={setEnergy} options={ENERGIES} />
            </GroupField>
            <GroupField label="Field">
              <Segmented value={field} onChange={setField} options={FIELDS} />
            </GroupField>
          </div>

          <div className="grid gap-4 border-t border-[color:var(--mist)] pt-6">
            <Field
              label="Sensory ingredients and props"
              helper="Three to seven meaningful objects work better than a catalogue."
            >
              <textarea
                value={ingredients}
                onChange={(event) => setIngredients(event.target.value)}
                maxLength={300}
                rows={3}
                className="ck-input ck-input--area w-full"
              />
            </Field>

            <Field label="Palette">
              <input
                type="text"
                value={palette}
                onChange={(event) => setPalette(event.target.value)}
                maxLength={240}
                className="ck-input w-full"
              />
            </Field>

            <Field
              label="Product or vessel detail"
              helper="Useful for a named glass shape, material, pack silhouette or liquid colour."
            >
              <textarea
                value={productDescription}
                onChange={(event) => setProductDescription(event.target.value)}
                maxLength={300}
                rows={2}
                placeholder="e.g. two low crystal coupes with pale rosé"
                className="ck-input w-full resize-y"
              />
            </Field>

            {productMode ? (
              <Field
                label="Product reference"
                helper="Optional JPG, PNG or WebP. The prompt treats pack shape and materials as fixed."
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    setProductFile(event.target.files?.[0] ?? null);
                    setFileError("");
                  }}
                  className="block w-full rounded-xl border border-[color:var(--mist-strong)] bg-white px-3 py-2 text-sm text-[color:var(--ink)] file:mr-3 file:rounded-lg file:border-0 file:bg-[color:var(--lav-bg)] file:px-3 file:py-2 file:font-semibold file:text-[color:var(--purple)]"
                />
                {fileError ? (
                  <span className="mt-2 block text-sm text-[color:var(--danger)]">{fileError}</span>
                ) : null}
              </Field>
            ) : null}

            <Field label="Extra direction">
              <textarea
                value={extra}
                onChange={(event) => setExtra(event.target.value)}
                maxLength={600}
                rows={3}
                placeholder="Anything this campaign must include or avoid"
                className="ck-input ck-input--area w-full"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-[color:var(--mist)] pt-6">
            <GroupField label="Variations">
              <Segmented
                value={String(count)}
                onChange={(value) => setCount(Number(value))}
                options={[1, 2, 3].map((value) => ({
                  value: String(value),
                  label: String(value),
                }))}
              />
            </GroupField>
            <GroupField label="Model">
              <Segmented value={model} onChange={setModel} options={MODELS} />
            </GroupField>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className={`ck-btn ck-btn--primary ck-btn--lg ck-btn--full ${generating ? "ck-btn--loading" : ""}`}
          >
            <span className="ck-btn__label">{actionLabel}</span>
            {generating ? <span aria-hidden className="ck-btn__spinner" /> : null}
          </button>
        </div>
      </section>

      <section aria-live="polite" aria-busy={generating}>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-[color:var(--ink)]">
              Campaign worlds
            </h2>
            <p className="mt-1 text-sm text-[color:var(--slate)]">
              Masters stay unblurred so the email can control crop, dimming and softness.
            </p>
          </div>
          {results.length > 0 ? (
            <button
              type="button"
              onClick={() => setResults([])}
              disabled={generating}
              className="ck-btn ck-btn--ghost ck-btn--sm"
            >
              Clear all
            </button>
          ) : null}
        </div>

        {results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--mist-strong)] bg-[color:var(--lav-bg)] px-6 py-14 text-left sm:px-10">
            <p className="font-display text-lg font-semibold text-[color:var(--ink)]">
              Start with the world, not the bottle
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--slate)]">
              Try a glass catching pool light, a theatrical paper set, or the trace of a
              pour. Paired mode will carry the chosen visual language into the bottom image.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {results.map((result) => (
              <article
                key={result.id}
                className="rounded-2xl bg-white p-4 shadow-[0_12px_30px_-18px_rgba(28,24,48,0.28)] sm:p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--slate)]">
                      {result.worldLabel}
                    </p>
                    <h3 className="font-display mt-1 truncate text-base font-semibold text-[color:var(--ink)]">
                      {result.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setResults((previous) => previous.filter((item) => item.id !== result.id))
                    }
                    disabled={
                      result.hero?.status === "loading" || result.closer?.status === "loading"
                    }
                    className="ck-btn ck-btn--ghost ck-btn--sm shrink-0"
                  >
                    Remove
                  </button>
                </div>

                <div className={`grid gap-4 ${result.hero && result.closer ? "md:grid-cols-2" : ""}`}>
                  {result.hero ? (
                    <ResultFigure
                      image={result.hero}
                      label="Hero image"
                      downloadName={`${safeFileName(result.title) || "campaign"}-hero-${result.id}.png`}
                    />
                  ) : null}
                  {result.closer ? (
                    <ResultFigure
                      image={result.closer}
                      label="Bottom image"
                      downloadName={`${safeFileName(result.title) || "campaign"}-bottom-${result.id}.png`}
                    />
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ResultFigure({
  image,
  label,
  downloadName,
}: {
  image: ImageResult;
  label: string;
  downloadName: string;
}) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--mist)] bg-[color:var(--champagne)]">
      <div
        className="relative w-full overflow-hidden bg-[color:var(--mist)]"
        style={{ aspectRatio: image.aspect }}
      >
        {image.status === "loading" ? (
          <div className="absolute inset-0 animate-pulse bg-[color:var(--lav-bg)]">
            <span className="absolute inset-x-5 top-5 h-3 rounded bg-[color:var(--mist)]" />
            <span className="absolute inset-x-5 top-11 h-3 rounded bg-[color:var(--mist)]" />
          </div>
        ) : null}
        {image.status === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm leading-6 text-[color:var(--danger)]">
            {image.error}
          </div>
        ) : null}
        {image.status === "done" && image.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL
          <img
            src={image.url}
            alt={`${label} generated for this campaign world`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
      </div>
      <figcaption className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
        <span className="text-sm font-medium text-[color:var(--ink)]">{label}</span>
        {image.status === "done" && image.url ? (
          <a
            href={image.url}
            download={downloadName}
            className="text-sm font-semibold text-[color:var(--purple)] underline-offset-4 hover:underline"
          >
            Download
          </a>
        ) : (
          <span className="text-xs text-[color:var(--slate)]">
            {image.status === "loading" ? "Generating" : "Needs another pass"}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
