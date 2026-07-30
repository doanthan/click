import { notFound } from "next/navigation";
import { isProductionDeployment } from "@/lib/runtime-mode";

export default function ScaleLayout({ children }: { children: React.ReactNode }) {
  if (isProductionDeployment()) notFound();
  return children;
}
