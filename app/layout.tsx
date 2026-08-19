import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegistrar } from "./components/PwaRegistrar";

export const metadata: Metadata = {
  metadataBase: new URL("https://qijian.everanz.com"),
  title: "栖笺 · 我们的手记",
  description: "让两个人的日常，有一处安静栖居。",
  applicationName: "栖笺",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "栖笺",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "栖笺 · 我们的手记",
    description: "让两个人的日常，有一处安静栖居。",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "栖笺 · 让两个人的日常，有一处安静栖居。" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "栖笺 · 我们的手记",
    description: "让两个人的日常，有一处安静栖居。",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#171713" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}<PwaRegistrar /></body></html>;
}
