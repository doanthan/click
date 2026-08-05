import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign in or sign up",
  description: "Unified entry point for Click sign-in and sign-up.",
};

function isSafeRelative(value: string | undefined) {
  return !!value && value.startsWith("/") && !value.startsWith("//");
}

type AuthPageProps = {
  searchParams?: Promise<{
    mode?: string;
    callbackUrl?: string;
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const callback = isSafeRelative(params?.callbackUrl) ? params!.callbackUrl! : "/post-login";
  const target = params?.mode === "signup" ? "/register" : "/login";
  redirect(`${target}?callbackUrl=${encodeURIComponent(callback)}`);
}
