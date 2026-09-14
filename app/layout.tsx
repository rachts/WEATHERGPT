import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WeatherGPT — IMD Kisan Weather",
  description: "Rural conversational weather intelligence for farmers by India Meteorological Department (MoES). Supports Hindi, Tamil, and English.",
  applicationName: "WeatherGPT",
  authors: [{ name: "Ministry of Earth Sciences / IMD" }],
  keywords: ["IMD", "Kisan Weather", "Raigad", "Agromet", "WeatherGPT", "AgriWeather", "Farmers"],
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
  openGraph: {
    type: "website",
    title: "WeatherGPT — IMD Kisan Weather",
    description: "Official conversational weather intelligence for rural India.",
    siteName: "WeatherGPT",
  },
};

export const viewport: Viewport = {
  themeColor: "#2D5016",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        <Navigation>{children}</Navigation>
      </body>
    </html>
  );
}
