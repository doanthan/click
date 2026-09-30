import { RouteTransition } from "@/components/route-transition";

// A template rather than a layout because it remounts on a route change, and
// that remount is what gives RouteTransition an exit and an enter to animate.
// This one covers a change of top-level section (/discover -> /events/...,
// /dashboard -> /people). The nested templates cover moves between pages
// inside one section.
export default RouteTransition;
