import { LoadingScreen } from "@/components/loading-spinner";
import { RouteSkeleton } from "@/components/route-transition";

export default function RootLoading() {
  return (
    <RouteSkeleton>
      <LoadingScreen label="Loading Click…" />
    </RouteSkeleton>
  );
}
