import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { pushConfig } from '@/config';

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export function isPushConfigured(): boolean {
  return Boolean(pushConfig.publicKey && pushConfig.privateKey);
}

let vapidReady = false;

function ensureVapid() {
  if (vapidReady || !isPushConfigured()) return;
  webpush.setVapidDetails(pushConfig.subject, pushConfig.publicKey as string, pushConfig.privateKey as string);
  vapidReady = true;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!isPushConfigured()) return;
  ensureVapid();

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          body
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
        }
      }
    })
  );
}
