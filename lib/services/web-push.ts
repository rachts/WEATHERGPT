// WeatherGPT — Web Push Notification Dissemination Service
// Delivers instant, free-tier native push notifications to Android devices & desktop browsers.

import webpush from "web-push";
import { logger } from "@/lib/utils/logger";

export interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  district?: string;
  subscribedAt?: string;
}

// In-memory subscription registry (with process-level dedup by endpoint)
const subscriptionsMap = new Map<string, PushSubscriptionPayload>();

// Configure Web Push VAPID credentials
const DEFAULT_VAPID_SUBJECT = "mailto:weathergpt-alerts@nic.in";
let isVapidConfigured = false;
let vapidWarningLogged = false;

function ensureVapidConfigured(): boolean {
  if (isVapidConfigured) return true;

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;

  if (!pub || !priv) {
    if (!vapidWarningLogged) {
      logger.warn("Web Push disabled: NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is missing.");
      vapidWarningLogged = true;
    }
    return false;
  }

  try {
    webpush.setVapidDetails(sub, pub, priv);
    isVapidConfigured = true;
    return true;
  } catch (err) {
    logger.warn("Failed to set VAPID details for web-push", { error: (err as Error).message });
    return false;
  }
}

/**
 * Register or update a browser push subscription
 */
export async function savePushSubscription(
  sub: PushSubscriptionPayload
): Promise<boolean> {
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return false;
  }

  subscriptionsMap.set(sub.endpoint, {
    ...sub,
    subscribedAt: new Date().toISOString(),
  });

  logger.info("Saved browser push subscription", {
    endpointSuffix: sub.endpoint.slice(-20),
    district: sub.district || "ALL",
    totalSubscribers: subscriptionsMap.size,
  });

  return true;
}

/**
 * Retrieve all registered push subscriptions
 */
export function getPushSubscriptions(): PushSubscriptionPayload[] {
  return Array.from(subscriptionsMap.values());
}

/**
 * Dispatches live Web Push alert to all matching device subscriptions
 */
export async function dispatchWebPushAlert(alert: {
  title: string;
  body: string;
  district?: string;
  severity?: string;
  url?: string;
}): Promise<{ total: number; sent: number; failed: number }> {
  if (!ensureVapidConfigured()) {
    return { total: 0, sent: 0, failed: 0 };
  }

  const subscriptions = getPushSubscriptions();
  if (subscriptions.length === 0) {
    return { total: 0, sent: 0, failed: 0 };
  }

  const payload = JSON.stringify({
    title: alert.title,
    body: alert.body,
    severity: alert.severity || "Warning",
    district: alert.district,
    url: alert.url || "/alerts",
    timestamp: new Date().toISOString(),
  });

  let sent = 0;
  let failed = 0;

  const targetSubs = alert.district
    ? subscriptions.filter(
        (s) => !s.district || s.district.toLowerCase() === alert.district?.toLowerCase()
      )
    : subscriptions;

  await Promise.allSettled(
    targetSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payload,
          {
            TTL: 3600, // 1 hour time to live
            urgency: "high",
          }
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const statusCode = (err as { statusCode?: number }).statusCode;
        // Clean up expired or unregistered endpoints (404/410 Gone)
        if (statusCode === 404 || statusCode === 410) {
          subscriptionsMap.delete(sub.endpoint);
        }
      }
    })
  );

  logger.info("Web push alert dissemination completed", {
    title: alert.title,
    district: alert.district,
    totalTargeted: targetSubs.length,
    sent,
    failed,
  });

  return { total: targetSubs.length, sent, failed };
}
