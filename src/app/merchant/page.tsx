import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MerchantSidebar, type MerchantTabKey } from "@/components/merchant-sidebar";
import {
  BookingsTabSkeleton,
  FinancesTabSkeleton,
} from "@/components/merchant-portal-shared";
import { DashboardTab } from "@/components/merchant-dashboard-tab";
import { EventsTab } from "@/components/merchant-events-tab";
import { BookingsTabAsync } from "@/components/merchant-bookings-tab";
import { FinancesTabAsync } from "@/components/merchant-finances-tab";
import { SettingsTab } from "@/components/merchant-settings-tab";
import { getMerchantEvents, getProfileStatus } from "@/lib/event-repository";

export const metadata = {
  title: "Merchant Portal | Click",
  description: "Click merchant portal for event hosts, booking models, payments, and analytics.",
};

// Consolidated from ten tabs down to five. Venues now live under Events,
// Attendees + Bookings merged into Bookings, Analytics folded into Dashboard,
// and Discounts + Support merged into Settings. Keys are validated against this
// list when reading `?tab=`.
const TAB_KEYS: MerchantTabKey[] = [
  "dashboard",
  "events",
  "bookings",
  "finances",
  "settings",
];

type MerchantPageProps = {
  searchParams?: Promise<{ month?: string; tab?: string }>;
};

export default async function MerchantPage({ searchParams }: MerchantPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/merchant/login?callbackUrl=/merchant");
  }

  const status = await getProfileStatus(session);
  if (!status.merchantProfile) {
    redirect("/merchant/signup");
  }
  // Spec §1: portal access is blocked until status='approved'. Pending or
  // rejected applications get the holding page instead of an empty portal.
  if (status.merchantProfile.verification_status !== "approved") {
    redirect("/merchant-pending");
  }
  // First visit after approval: send the merchant through the one-time
  // onboarding walkthrough (how-to + Stripe payout setup). It's skippable —
  // reaching the final step stamps onboarding_completed_at so we don't loop.
  if (!status.merchantProfile.onboarding_completed_at) {
    redirect("/merchant/onboarding");
  }

  const params = (await searchParams) ?? {};
  const tab: MerchantTabKey = TAB_KEYS.includes(params.tab as MerchantTabKey)
    ? (params.tab as MerchantTabKey)
    : "dashboard";

  const merchantEvents = await getMerchantEvents(session);
  // Past this point the merchant is always approved (the redirect above guards
  // it), so there's no "pending host" branch to render anymore.
  const businessName = status.merchantProfile.business_name;
  const payoutsEnabled = status.merchantProfile.payouts_enabled;
  const chargesEnabled = status.merchantProfile.charges_enabled;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] py-8 text-[color:var(--ink)] lg:py-10">
      {/* The ONE shared container: same max-width and, crucially, the same LEFT
          EDGE as every other page. */}
      <div className="ck-page flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-7">
        <MerchantSidebar
          activeTab={tab}
          businessName={businessName}
          counts={{ events: merchantEvents.length }}
        />
        {/* key={tab} replays the soft rise on every tab switch - a quiet cue
            that the content pane changed while the chrome held still. */}
        <div key={tab} className="rise-soft min-w-0 flex-1">
          {tab === "dashboard" ? (
            <DashboardTab
              merchantEvents={merchantEvents}
              monthParam={params.month}
              businessName={businessName}
              payoutsEnabled={payoutsEnabled}
              chargesEnabled={chargesEnabled}
              attendeeOnboarded={status.onboardingComplete}
              attendingCount={status.registeredEventIds.length}
            />
          ) : null}
          {tab === "events" ? <EventsTab events={merchantEvents} /> : null}
          {/* Async tab queries get their own Suspense boundary so a slow
              attendees/finances read streams into the tab body without holding
              up the merchant chrome (sidebar + tab bar) that's already painted. */}
          {tab === "bookings" ? (
            <Suspense fallback={<BookingsTabSkeleton />}>
              <BookingsTabAsync session={session} />
            </Suspense>
          ) : null}
          {tab === "finances" ? (
            <Suspense fallback={<FinancesTabSkeleton />}>
              <FinancesTabAsync session={session} />
            </Suspense>
          ) : null}
          {tab === "settings" ? (
            <SettingsTab
              businessName={businessName}
              verification={status.merchantProfile.verification_status}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
