import { LifeQuizStep } from "@/components/life-quiz-wizard";

export const metadata = {
  title: "Life stage · Life Quiz",
};

// Step 1/4 · Life stage.
export default function LifeStagePage() {
  return <LifeQuizStep step={0} />;
}
