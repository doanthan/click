"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveReport, suspendMemberAsAdmin } from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveReportAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/reports");

  const id = formData.get("report_id");
  const resolution = formData.get("resolution");
  const note = formData.get("note");
  if (typeof id !== "string" || !UUID_RE.test(id)) return;
  if (resolution !== "actioned" && resolution !== "dismissed") return;

  await resolveReport(session, id, resolution, typeof note === "string" ? note : undefined);
  revalidatePath("/admin/reports");
}

// Suspend the reported account straight from the queue, then mark the report
// actioned in one step.
export async function suspendFromReportAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/reports");

  const reportedId = formData.get("reported_id");
  const reportId = formData.get("report_id");
  const reason = formData.get("reason");
  if (typeof reportedId !== "string" || !UUID_RE.test(reportedId)) return;

  // One reason string serves both writes: the suspension record AND the report
  // resolution note. Previously the note was the constant "Account suspended.",
  // so the resolved queue could never say why the call was made.
  const suspensionReason =
    typeof reason === "string" && reason.trim() !== ""
      ? reason.trim()
      : "Suspended from safety report queue.";

  await suspendMemberAsAdmin(session, reportedId, suspensionReason);
  if (typeof reportId === "string" && UUID_RE.test(reportId)) {
    await resolveReport(session, reportId, "actioned", `Account suspended - ${suspensionReason}`);
  }
  revalidatePath("/admin/reports");
}
