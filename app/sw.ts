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

const apiCacheRule = {
  matcher: ({ url }: { url: URL }) =>
    url.pathname.startsWith("/api/weather") ||
    url.pathname.startsWith("/api/alerts") ||
    url.pathname.startsWith("/api/advisory") ||
    url.pathname.startsWith("/api/synoptic") ||
    url.pathname.startsWith("/api/satellite"),
  handler: new NetworkFirst({
    cacheName: "weathergpt-api-cache",
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours offline cache
      }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [apiCacheRule, ...defaultCache],
});

serwist.addEventListeners();
