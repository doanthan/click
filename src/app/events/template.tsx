import { RouteTransition } from "@/components/route-transition";

// One event page to another. The root template only remounts when the
// top-level section changes, so moves inside this one need their own.
export default RouteTransition;
