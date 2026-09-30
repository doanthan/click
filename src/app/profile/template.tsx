import { RouteTransition } from "@/components/route-transition";

// /profile <-> /profile/edit, and one person's profile to another's. The root
// template only remounts when the top-level section changes, so moves inside
// this one need their own.
export default RouteTransition;
