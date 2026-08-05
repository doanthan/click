import { redirect } from "next/navigation";

export const metadata = {
  title: "Saved events",
};

export default function SavedEventsPage() {
  redirect("/bookmarks");
}
