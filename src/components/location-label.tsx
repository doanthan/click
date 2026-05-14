"use client";

import { useUserLocation } from "@/hooks/use-user-location";

type LocationLabelProps = {
  fallback?: string;
};

export function LocationLabel({ fallback = "Sydney" }: LocationLabelProps) {
  const { city } = useUserLocation();
  return <>{city ?? fallback}</>;
}
