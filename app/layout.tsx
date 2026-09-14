import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { I18nProvider } from "@/lib/i18n/context";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WeatherGPT — IMD Kisan Weather",
  description: "Rural conversational weather intelligence powered by IMD open data (Unofficial Student Prototype). Supports Hindi, Tamil, and English.",
  applicationName: "WeatherGPT",
  authors: [{ name: "WeatherGPT (Unofficial Student Prototype - SIH 2026)" }],
  keywords: ["IMD", "Kisan Weather", "Agromet", "WeatherGPT", "AgriWeather", "Farmers", "Pan-India"],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    title: "WeatherGPT — IMD Kisan Weather",
    description: "Powered by IMD open data — unofficial rural conversational weather prototype.",
    siteName: "WeatherGPT",
  },
};

export const viewport: Viewport = {
  themeColor: "#2D5016",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-bg text-text-primary flex flex-col antialiased`}>
        <I18nProvider>
          <Navigation>{children}</Navigation>
        </I18nProvider>
      </body>
    </html>
  );
}
