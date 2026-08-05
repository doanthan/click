import { LocationSection, WizardShell } from "@/components/event-create-wizard";

export const metadata = {
  title: "Location · Create event",
};

// Step 3/5 · Location.
export default function CreateEventLocationPage() {
  return (
    <WizardShell step={2}>
      <LocationSection />
    </WizardShell>
  );
}
