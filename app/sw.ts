/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, ExpirationPlugin, CacheableResponsePlugin } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const pageShellRule = {
  matcher: ({ request }: { request: Request }) => request.mode === "navigate",
  handler: new NetworkFirst({
    cacheName: "weathergpt-pages-cache",
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  }),
};

// High-frequency live meteorological & alert cache rule (30 minutes TTL)
// Critical for life safety: prevents stale disaster warnings or outdated weather numbers
const apiCacheRule = {
  matcher: ({ url }: { url: URL }) =>
    url.pathname.startsWith("/api/weather") ||
    url.pathname.startsWith("/api/alerts"),
  handler: new NetworkFirst({
    cacheName: "weathergpt-api-cache",
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 1800, // 30 minutes TTL for live weather and alerts
      }),
    ],
  }),
};

// Static advisory & satellite tile cache rule (24 hours TTL)
const staticApiCacheRule = {
  matcher: ({ url }: { url: URL }) =>
    url.pathname.startsWith("/api/advisory") ||
    url.pathname.startsWith("/api/synoptic") ||
    url.pathname.startsWith("/api/satellite"),
  handler: new NetworkFirst({
    cacheName: "weathergpt-static-cache",
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours offline cache for static resources
      }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [pageShellRule, apiCacheRule, staticApiCacheRule, ...defaultCache],
});

serwist.addEventListeners();

// Native Web Push Notification Listeners
self.addEventListener("push", (event: any) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || "WeatherGPT Alert";
    const options = {
      body: data.body || "New weather alert for your district.",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: {
        url: data.url || "/alerts",
      },
      tag: "weathergpt-alert",
      renotify: true,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("WeatherGPT Alert", {
        body: text,
        icon: "/icons/icon-192x192.png",
      })
    );
  }
});

self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/alerts";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList: any) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
