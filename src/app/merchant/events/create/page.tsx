import { redirect } from "next/navigation";

// The wizard lives at /merchant/events/create/<step>. This index entry just
// forwards into the first step; auth + merchant gating run in the shared
// layout.tsx that wraps every step page.
export default function CreateEventIndexPage() {
  redirect("/merchant/events/create/basics");
}
