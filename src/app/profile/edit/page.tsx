import { redirect } from "next/navigation";

export default function ProfileEditAlias() {
  redirect("/account-settings?tab=account");
}
