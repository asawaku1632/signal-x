import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaServiceWorkerRegistration from "./components/PwaServiceWorkerRegistration";
import MobileViewportRecovery from "./components/MobileViewportRecovery";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "SIGNALX",
  description: "AIによる日本株の分析と注目銘柄の確認を支援する情報サービス",
  applicationName: "SIGNALX",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icons/signalx-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/signalx-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SIGNALX",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          <PwaServiceWorkerRegistration />
          <MobileViewportRecovery />
          {children}
        </Providers>
      </body>
    </html>
  );
}
