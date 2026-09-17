// WeatherGPT — Phase 3 Hardening & Polish Automated Verification Suite
// Validates:
// 1. Prisma build pipeline readiness (generate & migrate deploy)
// 2. Metadata API (robots.txt & sitemap.xml)
// 3. Security headers (Strict Content-Security-Policy, X-Content-Type-Options, Frame Options)
// 4. API route backward compatibility (/api/v1/* version prefixing)

import assert from "assert";
import fs from "fs";
import path from "path";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import packageJson from "@/package.json";

export async function runPhase3Tests() {
  console.log("\n========================================================");
  console.log("   PHASE 3 VERIFICATION TESTS (Hardening & Polish)      ");
  console.log("========================================================\n");

  // Test 1: Build pipeline script is safe for serverless (prisma generate only, migrations decoupled)
  console.log("[Test 1] Verifying build pipeline script configuration...");
  assert.ok(
    packageJson.scripts.build.includes("prisma generate"),
    "build script must include 'prisma generate'"
  );
  assert.ok(
    !packageJson.scripts.build.includes("prisma migrate deploy"),
    "build script must NOT include 'prisma migrate deploy' (unsafe in serverless/CI builds)"
  );
  assert.strictEqual(
    packageJson.scripts["prisma:migrate:deploy"],
    "prisma migrate deploy",
    "dedicated 'prisma:migrate:deploy' script must exist for decoupled migration execution"
  );
  console.log("  ✔ Build pipeline script includes prisma generate, with migrations safely decoupled.");

  // Test 2: Next.js metadata API (robots.ts)
  console.log("\n[Test 2] Verifying robots.ts metadata generation...");
  const robotsConfig = robots();
  assert.ok(robotsConfig.rules, "robots configuration must define rules");
  assert.ok(robotsConfig.sitemap, "robots configuration must declare sitemap URL");
  console.log(`  ✔ robots.ts verified: sitemap=${robotsConfig.sitemap}`);

  // Test 3: Next.js metadata API (sitemap.ts)
  console.log("\n[Test 3] Verifying sitemap.ts metadata generation...");
  const sitemapEntries = sitemap();
  assert.ok(Array.isArray(sitemapEntries), "sitemap must return an array of route entries");
  assert.ok(sitemapEntries.length >= 7, "sitemap must index all major public routes");
  const urls = sitemapEntries.map((e) => e.url);
  assert.ok(urls.some((u) => u.includes("/forecast")), "sitemap must include /forecast");
  assert.ok(urls.some((u) => u.includes("/alerts")), "sitemap must include /alerts");
  assert.ok(urls.some((u) => u.includes("/radar")), "sitemap must include /radar");
  assert.ok(urls.some((u) => u.includes("/chat")), "sitemap must include /chat");
  console.log(`  ✔ sitemap.ts verified with ${sitemapEntries.length} indexed URLs.`);

  // Test 4: Content Security Policy & Security Headers in next.config.mjs
  console.log("\n[Test 4] Verifying security headers and CSP in next.config.mjs...");
  const configPath = path.resolve(process.cwd(), "next.config.mjs");
  assert.ok(fs.existsSync(configPath), "next.config.mjs must exist");
  const configContent = fs.readFileSync(configPath, "utf8");

  assert.ok(configContent.includes("X-Content-Type-Options"), "Must set X-Content-Type-Options");
  assert.ok(configContent.includes("nosniff"), "Must set nosniff");
  assert.ok(configContent.includes("X-Frame-Options"), "Must set X-Frame-Options");
  assert.ok(configContent.includes("DENY"), "Must set DENY");

  assert.ok(configContent.includes("Content-Security-Policy"), "Must set Content-Security-Policy");
  assert.ok(configContent.includes("script-src"), "CSP must declare script-src");
  assert.ok(configContent.includes("object-src 'none'"), "CSP must declare object-src 'none'");
  assert.ok(configContent.includes("base-uri 'self'"), "CSP must declare base-uri 'self'");
  console.log("  ✔ CSP verified with script-src, object-src 'none', and base-uri 'self'.");

  // Test 5: API Route Versioning Compatibility (/api/v1/* -> /api/*)
  console.log("\n[Test 5] Verifying API route rewrites in next.config.mjs...");
  assert.ok(
    configContent.includes('source: "/api/v1/:path*"'),
    "/api/v1/:path* rewrite source must be defined"
  );
  assert.ok(
    configContent.includes('destination: "/api/:path*"'),
    "/api/:path* rewrite destination must be defined"
  );
  console.log("  ✔ API route rewrites verified for /api/v1/* -> /api/* compatibility.");

  console.log("\n========================================================");
  console.log("   ALL PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY!   ");
  console.log("========================================================\n");
}
