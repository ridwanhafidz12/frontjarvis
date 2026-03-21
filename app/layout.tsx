import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JARVIS — AI Control System",
  description: "Advanced remote PC control dashboard powered by AI. Monitor system, control applications, manage files, and communicate via Telegram.",
  keywords: ["JARVIS", "remote control", "PC monitoring", "AI assistant", "system control"],
  authors: [{ name: "JARVIS System" }],
  robots: "noindex, nofollow",  // private tool — don't index
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/logo-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JARVIS",
  },
  openGraph: {
    title: "JARVIS Control System",
    description: "AI-powered remote PC control dashboard",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,       // prevent unwanted zoom on iOS input focus
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#00d4ff" },
    { media: "(prefers-color-scheme: light)", color: "#00d4ff" },
  ],
  viewportFit: "cover",  // safe area on notched phones
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Preconnect to Google Fonts for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* DNS prefetch for common JARVIS URLs */}
        <link rel="dns-prefetch" href="https://api.telegram.org" />
        <meta name="color-scheme" content="dark" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
      </head>
      <body>
        {/* Scan line animation (decorative) */}
        <div className="scanline" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
