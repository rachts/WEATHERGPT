/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  async rewrites() {
    return [
      // API Versioning: /api/v1/* rewrites to /api/* while keeping original routes intact
      {
        source: "/api/v1/:path*",
        destination: "/api/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // strict-dynamic enables trusted scripts while providing backward compatibility with 'self' and 'unsafe-inline'
              "script-src 'self' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval' https: http:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://mausam.imd.gov.in https://reactjs.imd.gov.in https://internal.imd.gov.in https://satellite.imd.gov.in https://gibs.earthdata.nasa.gov https://*.tile.openstreetmap.org https://tilecache.rainviewer.com https://*.basemaps.cartocdn.com",
              "connect-src 'self' https://reactjs.imd.gov.in https://internal.imd.gov.in https://satellite.imd.gov.in https://api.open-meteo.com https://gibs.earthdata.nasa.gov https://*.tile.openstreetmap.org https://demotiles.maplibre.org https://generativelanguage.googleapis.com https://api.rainviewer.com https://tilecache.rainviewer.com https://*.basemaps.cartocdn.com",
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With, x-ingestion-token" },
        ],
      },
    ];
  },
};

export default async function () {
  if (process.env.NODE_ENV === "production") {
    try {
      const withSerwistInit = (await import("@serwist/next")).default;
      const withSerwist = withSerwistInit({
        swSrc: "app/sw.ts",
        swDest: "public/sw.js",
        disable: false,
      });
      return withSerwist(nextConfig);
    } catch {
      return nextConfig;
    }
  }

  return nextConfig;
}
