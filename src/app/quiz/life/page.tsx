import { redirect } from "next/navigation";

// Entry point for /quiz/life. The auth gate lives in the layout; here we just
// forward to the first wizard step so /quiz/life is a stable, linkable URL.
export default function LifeQuizPage() {
  redirect("/quiz/life/life-stage");
}
