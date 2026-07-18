import ImageStudio from "./studio";

export const metadata = {
  title: "Event image studio | Click",
};

// Internal marketing tool - generates candid, film-grade event photography
// for front-page and campaign use via the Gemini image API (see
// src/lib/image-gen.ts for the prompt system). Not linked from public nav.
export default function ImagesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Internal tool</p>
      <h1 className="font-display mt-2 text-3xl text-[color:var(--ink)] sm:text-4xl">
        Event image studio
      </h1>
      <p className="mt-2 max-w-2xl text-[color:var(--slate)]">
        Candid, 35mm-film-grade event photography for the front page - real-attendee
        energy, Sydney through and through. Pick an event, tune the shot, generate a
        batch, download the keepers.
      </p>
      <ImageStudio />
    </main>
  );
}
