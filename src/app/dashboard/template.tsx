import { RouteTransition } from "@/components/route-transition";

// /dashboard <-> /dashboard/calendar. The root template only remounts when the
// top-level section changes, so moves inside this one need their own.
export default RouteTransition;
