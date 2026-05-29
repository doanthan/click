import { MediaSection, WizardShell } from "@/components/event-create-wizard";

export const metadata = {
  title: "Media · Create event | Click",
};

// Step 4/5 · Media.
export default function CreateEventMediaPage() {
  return (
    <WizardShell step={3}>
      <MediaSection />
    </WizardShell>
  );
}
