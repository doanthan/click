import { RouteTransition } from "@/components/route-transition";

// /categories <-> /categories/[slug]. The root template only remounts when the
// top-level section changes, so moves inside this one need their own.
export default RouteTransition;
