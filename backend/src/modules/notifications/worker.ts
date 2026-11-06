import { setTimeout as delay } from 'node:timers/promises';
import type { Pool } from 'pg';
import { claimNotification, finalizeNotification } from './outbox.js';
import { DeliveryError, type DeliveryErrorCode, type NotificationSender } from './sender.js';
import { renderEnquiry } from './template.js';

export async function processNotification(pool: Pool, sender: NotificationSender, maxAttempts: number): Promise<boolean> {
  const claim = await claimNotification(pool, maxAttempts);
  if (!claim) return false;

  const message = renderEnquiry(claim);
  let errorCode: DeliveryErrorCode | undefined;
  try {
    await sender.send(claim.job_id, message);
  } catch (error) {
    errorCode = error instanceof DeliveryError ? error.code : 'smtp_temporary';
  }
  await finalizeNotification(pool, claim, maxAttempts, errorCode);
  return true;
}

export async function runWorker(
  pool: Pool, sender: NotificationSender, maxAttempts: number, signal: AbortSignal,
  onDatabaseError: () => void,
): Promise<void> {
  while (!signal.aborted) {
    try {
      if (await processNotification(pool, sender, maxAttempts)) continue;
    } catch {
      onDatabaseError();
    }

    try {
      await delay(2_000, undefined, { signal });
    } catch (error) {
      if (!signal.aborted) throw error;
    }
  }
}
