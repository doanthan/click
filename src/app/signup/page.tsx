import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign up",
};

function isSafeRelative(value: string | undefined) {
  return !!value && value.startsWith("/") && !value.startsWith("//");
}

type SignupPageProps = {
  searchParams?: Promise<{ callbackUrl?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const callback = isSafeRelative(params?.callbackUrl) ? params!.callbackUrl! : "/post-login";
  redirect(`/register?callbackUrl=${encodeURIComponent(callback)}`);
}
