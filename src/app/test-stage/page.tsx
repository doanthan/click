import { notFound } from "next/navigation";
import { isProductionDeployment } from "@/lib/runtime-mode";
import StageStudio from "./studio";

export const metadata = {
  title: "Email stage studio",
  description:
    "Build atmospheric hero and closing images that share one campaign world.",
};

// Internal campaign tool. It is intentionally absent from public navigation
// and blocked in production alongside the other test and generation surfaces.
export default function TestStagePage() {
  if (isProductionDeployment()) notFound();

  return (
    <main className="mx-auto w-full max-w-[1320px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
      <header className="max-w-3xl">
        <p className="eyebrow">Internal campaign tool</p>
        <h1 className="font-display mt-3 text-3xl font-semibold leading-tight text-[color:var(--ink)] sm:text-4xl">
          Build the world around the email
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--slate)]">
          Create an atmospheric hero and a related bottom image. Glassware, products,
          ingredients or pure set design can carry the idea.
        </p>
      </header>

      <StageStudio />
    </main>
  );
}
