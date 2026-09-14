// WeatherGPT — Development Service Worker Self-Destruct Handler
// In development, if a browser still has a service worker installed from a prior production build,
// this handler provides an immediate self-unregister script that prevents stale chunk 404s.
// In production builds, Serwist's compiled public/sw.js serves the full offline PWA worker.

export const dynamic = "force-dynamic";

export function GET() {
  if (process.env.NODE_ENV !== "production") {
    const unregisterScript = `// Development mode: unregister any stale production ServiceWorker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => {
      return self.clients.matchAll({ type: 'window' });
    }).then((clients) => {
      // Notify active client tabs to clear stale caches
      clients.forEach((client) => {
        if (client.url && 'navigate' in client) {
          // No-op or soft reload if necessary
        }
      });
    })
  );
});
`;
    return new Response(unregisterScript, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  return new Response("Not found in production fallback route.", { status: 404 });
}
