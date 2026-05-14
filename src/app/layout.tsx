import type { Metadata } from "next";
import {
  Caveat,
  Fraunces,
  IBM_Plex_Mono,
  Manrope,
  Shrikhand,
} from "next/font/google";
import { LoginModalHost } from "@/components/login-modal-host";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-click-body",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-click-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-click-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-click-script",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

const shrikhand = Shrikhand({
  variable: "--font-click-brand",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Click — A burst of YES",
  description:
    "Click helps ordinary people find local groups, dating, friendship and Sydney events with a reason to talk.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);
  const showDemoCredentials = process.env.NODE_ENV !== "production";

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${manrope.variable} ${fraunces.variable} ${plexMono.variable} ${caveat.variable} ${shrikhand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
        <SiteFooter />
        <LoginModalHost
          googleConfigured={googleConfigured}
          metaConfigured={metaConfigured}
          showDemoCredentials={showDemoCredentials}
        />
      </body>
    </html>
  );
}
