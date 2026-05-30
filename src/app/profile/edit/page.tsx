import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AvatarUploader } from "@/components/avatar-uploader";
import { getOwnProfile } from "@/lib/event-repository";
import { saveProfileEditAction } from "./actions";

export const metadata = {
  title: "Edit profile | Click",
};

const intentOptions: { value: string; label: string; body: string }[] = [
  { value: "friendship",  label: "Friendship",  body: "Low-pressure plans to make new friends." },
  { value: "dating",      label: "Dating",      body: "Slow dating tables and relationship-minded events." },
  { value: "networking",  label: "Networking",  body: "Career switchers, founders, peer support." },
  { value: "hobbies",     label: "Hobbies",     body: "Find people who share your craft — creative, sport, gaming, books." },
  { value: "wellness",    label: "Wellness",    body: "Slow mornings, mindful movement, sober-friendly nights." },
  { value: "community",   label: "Community",   body: "Local meetups, volunteering, neighbourhood vibes." },
  { value: "new_in_town", label: "New in town", body: "Just relocated — looking to plug into Sydney fast." },
  { value: "exploring",   label: "Exploring",   body: "Just curious — show me a bit of everything." },
];

export default async function EditProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/profile/edit");
  }

  const profile = await getOwnProfile(session);
  if (!profile) {
    redirect("/onboarding");
  }

  const selectedIntents = new Set(profile.intents);

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-8 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-4xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Edit profile
        </span>

        <form action={saveProfileEditAction} className="mt-5 grid gap-5 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm">
          <AvatarUploader
            initialUrl={profile.photoUrl}
            displayName={profile.displayName}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Display name" name="display_name" defaultValue={profile.displayName} required />
            <Field label="Suburb" name="suburb" defaultValue={profile.suburb ?? ""} />
            <Field
              label="Age (optional)"
              name="age"
              type="number"
              min={18}
              defaultValue={profile.age?.toString() ?? ""}
            />
          </div>

          <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Bio
            </span>
            <textarea
              name="bio"
              rows={4}
              defaultValue={profile.bio ?? ""}
              className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] outline-none focus:bg-[color:var(--cream)]"
              placeholder="A short, friendly intro — what you’re into, what you’re here for."
            />
          </label>

          <fieldset className="grid gap-3">
            <legend className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Intents (pick any)
            </legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {intentOptions.map((opt) => {
                const checked = selectedIntents.has(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="cursor-pointer rounded-2xl border-2 border-[color:var(--line)] p-4 hard-shadow-sm transition-colors bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)] has-[:checked]:bg-[color:var(--rose)] has-[:checked]:text-[color:var(--surface-deep)] has-[:checked]:hover:bg-[color:var(--rose)]"
                  >
                    <input
                      type="checkbox"
                      name="intent"
                      value={opt.value}
                      defaultChecked={checked}
                      className="sr-only"
                    />
                    <span className="block text-sm font-bold uppercase tracking-wide">
                      {opt.label}
                    </span>
                    <span className="mt-1 block text-xs font-semibold leading-5 opacity-80">
                      {opt.body}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Link
              href="/profile"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              Save profile
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  min,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  min?: number;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        placeholder={placeholder}
        className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/55 outline-none focus:bg-[color:var(--cream)]"
      />
    </label>
  );
}
