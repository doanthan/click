import type { AccountImpersonation } from "@/lib/account-switch-policy";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    impersonation?: AccountImpersonation;
    sessionVersion?: string;
  }
  interface User {
    impersonation?: AccountImpersonation;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    impersonation?: AccountImpersonation;
    sessionVersion?: string;
  }
}
