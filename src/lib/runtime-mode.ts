const INTERNAL_ROUTE_PREFIXES = [
  "/algo",
  "/business",
  "/email",
  "/images",
  "/md",
  "/scale",
  "/tables",
  "/test",
  "/test-click",
  "/test-stage",
] as const;

const INTERNAL_API_PREFIXES = [
  "/api/generate",
  "/api/generate-stage",
  "/api/tables",
  "/api/test",
] as const;

export function isLocalDevelopment() {
  return process.env.NODE_ENV === "development";
}

export function isProductionDeployment() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function isInternalRoute(pathname: string) {
  return [...INTERNAL_ROUTE_PREFIXES, ...INTERNAL_API_PREFIXES].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isClickMechanicEnabled() {
  const configured = process.env.CLICK_MECHANIC_ENABLED?.trim().toLowerCase();
  if (configured) return configured === "true";
  return !isProductionDeployment();
}

export function assertLocalDevelopment(feature: string): void {
  if (!isLocalDevelopment()) {
    throw new Error(`${feature} is only available in local development.`);
  }
}

export function internalApiNotFound(): Response | null {
  if (!isProductionDeployment()) return null;
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}
