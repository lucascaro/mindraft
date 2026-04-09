import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { InstallPrompt } from "@/components/install-prompt";
import { ServiceWorkerRegistrar } from "@/components/sw-registrar";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mindraft",
  description: "Capture ideas on the go. Refine them later.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mindraft",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      style={{ height: "100%" }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{
          margin: 0,
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
          maxWidth: "100vw",
        }}
      >
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <InstallPrompt />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
