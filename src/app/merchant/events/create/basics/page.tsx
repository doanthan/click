import { BasicsSection, WizardShell } from "@/components/event-create-wizard";

export const metadata = {
  title: "Basics · Create event | Click",
};

// Step 1/5 · Basics.
export default function CreateEventBasicsPage() {
  return (
    <WizardShell step={0}>
      <BasicsSection />
    </WizardShell>
  );
}
