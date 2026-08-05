import { LifeQuizStep } from "@/components/life-quiz-wizard";

export const metadata = {
  title: "Energy & mood · Life Quiz",
};

// Step 4/4 · Energy and mood → Save.
export default function EnergyPage() {
  return <LifeQuizStep step={3} />;
}
