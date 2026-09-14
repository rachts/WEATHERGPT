import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://weathergpt.in";
  const routes = [
    "",
    "/forecast",
    "/alerts",
    "/radar",
    "/satellite",
    "/chat",
    "/settings",
    "/privacy",
    "/onboarding",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/alerts" ? "hourly" : "daily",
    priority: route === "" ? 1.0 : route === "/alerts" || route === "/forecast" ? 0.9 : 0.7,
  }));
}
