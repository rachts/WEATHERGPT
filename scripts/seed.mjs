// WeatherGPT — deterministic demo seed
// The application intentionally keeps the production data path live-only. This
// script seeds only clearly labelled demo-mode records for a repeatable judge
// walkthrough and is safe to run more than once.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bulletinsPath = path.join(rootDir, "lib/data/seeded-bulletins.json");

function hashAlert(alert) {
  return crypto
    .createHash("sha256")
    .update([alert.sourceId, alert.districtCode, alert.issueTime, alert.warningText].join("|"))
    .digest("hex");
}

async function seed() {
  if (process.env.WEATHERGPT_MODE === "production") {
    console.log("✓ Production mode: demo seed skipped.");
    return;
  }

  const bulletins = JSON.parse(fs.readFileSync(bulletinsPath, "utf8"));
  const bulletin = bulletins.find((item) => item.product.includes("Impact-Based Warning")) ?? bulletins[5];

  if (!bulletin) throw new Error("No demo bulletin is available to seed.");
  console.log(`✓ Validated ${bulletins.length} dated demo bulletin chunks for Raigad`);

  if (!process.env.DATABASE_URL?.startsWith("postgres")) {
    console.log("✓ No PostgreSQL configured; local JSON fallback remains the demo source.");
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const issueTime = new Date(bulletin.issueTime);
  const validTo = new Date(issueTime.getTime() + 24 * 60 * 60 * 1000);
  const alert = {
    sourceId: bulletin.id,
    districtCode: "MH-RAIGAD",
    district: "Raigad",
    state: "Maharashtra",
    severity: "Moderate",
    officialSeverity: "Yellow",
    eventType: "Thunderstorm",
    headline: "Demo replay: isolated thunderstorms and lightning",
    warningText: bulletin.content,
    rawBulletin: bulletin.content,
    normalizedBulletin: bulletin.content,
    sourceProduct: `${bulletin.product} (demo replay)`,
    sourceUrl: "https://mausam.imd.gov.in/",
    issueTime,
    validFrom: issueTime,
    validTo,
    isActive: true,
  };

  try {
    await prisma.alert.upsert({
      where: { alertHash: hashAlert(alert) },
      update: alert,
      create: { ...alert, alertHash: hashAlert(alert) },
    });
    console.log("✓ Seeded one idempotent Raigad demo alert for the dashboard.");
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
