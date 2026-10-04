"use client";

import dynamic from "next/dynamic";
// Started eagerly, as before, so the console and network history a report
// attaches exists before anyone opens the panel.
import "@/lib/support-capture";

// The Report-a-Bug widget mounts for every visitor pre-launch (layout.tsx), and
// it is ~27KB of script that nobody needs until they tap the bug. Imported
// statically it rode in the first load of every page, where on a phone it
// shared the opening seconds of bandwidth with the stylesheet and the LCP
// photo. Fetched once the page has hydrated, the button just lands a beat later.
const SupportWidgetPanel = dynamic(() => import("./support-widget"), { ssr: false });

export default function SupportWidget({ canTriage = false }: { canTriage?: boolean }) {
  return <SupportWidgetPanel canTriage={canTriage} />;
}
