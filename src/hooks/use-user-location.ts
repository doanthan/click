"use client";

import { useEffect, useState } from "react";

export type UserLocation = {
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: boolean;
};

const STORAGE_KEY = "click:user-location";

const initialState: UserLocation = {
  city: null,
  region: null,
  country: null,
  latitude: null,
  longitude: null,
  loading: true,
  error: false,
};

function getInitialLocation(): UserLocation {
  if (typeof window === "undefined") return initialState;

  try {
    const cached = window.sessionStorage.getItem(STORAGE_KEY);
    if (!cached) return initialState;
    const parsed = JSON.parse(cached) as Partial<UserLocation>;
    return {
      city: parsed.city ?? null,
      region: parsed.region ?? null,
      country: parsed.country ?? null,
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      loading: false,
      error: false,
    };
  } catch {
    return initialState;
  }
}

export function useUserLocation(): UserLocation {
  const [state, setState] = useState<UserLocation>(getInitialLocation);

  useEffect(() => {
    if (!state.loading) return;

    let cancelled = false;

    fetch("https://ipapi.co/json/")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data: Record<string, unknown>) => {
        if (cancelled) return;
        const next: UserLocation = {
          city: typeof data.city === "string" ? data.city : null,
          region:
            typeof data.region_code === "string"
              ? data.region_code
              : typeof data.region === "string"
                ? data.region
                : null,
          country:
            typeof data.country_code === "string"
              ? data.country_code
              : typeof data.country === "string"
                ? data.country
                : null,
          latitude: typeof data.latitude === "number" ? data.latitude : null,
          longitude: typeof data.longitude === "number" ? data.longitude : null,
          loading: false,
          error: false,
        };
        setState(next);
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore quota and privacy mode failures.
        }
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          city: null,
          region: null,
          country: null,
          latitude: null,
          longitude: null,
          loading: false,
          error: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [state.loading]);

  return state;
}
