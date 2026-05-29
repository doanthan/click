import { ReviewSection, WizardShell } from "@/components/event-create-wizard";

export const metadata = {
  title: "Review · Create event | Click",
};

// Step 5/5 · Review → Submit.
export default function CreateEventReviewPage() {
  return (
    <WizardShell step={4}>
      <ReviewSection />
    </WizardShell>
  );
}
