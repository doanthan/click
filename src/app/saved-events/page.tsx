import { redirect } from "next/navigation";

export const metadata = {
  title: "Saved events | Click",
};

export default function SavedEventsPage() {
  redirect("/bookmarks");
}
