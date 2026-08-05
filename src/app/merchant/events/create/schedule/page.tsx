import { ScheduleSection, WizardShell } from "@/components/event-create-wizard";

export const metadata = {
  title: "Schedule · Create event",
};

// Step 2/5 · Schedule.
export default function CreateEventSchedulePage() {
  return (
    <WizardShell step={1}>
      <ScheduleSection />
    </WizardShell>
  );
}
