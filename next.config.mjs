/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

let config = nextConfig;

if (process.env.NODE_ENV === "production") {
  const withSerwistInit = (await import("@serwist/next")).default;
  const withSerwist = withSerwistInit({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    disable: false,
  });
  config = withSerwist(nextConfig);
}

export default config;
