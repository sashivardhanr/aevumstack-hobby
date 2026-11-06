import type { Notification } from './template.js';

export interface NotificationSender {
  send(jobId: string, message: Notification): Promise<void>;
}

export type DeliveryErrorCode = 'smtp_temporary' | 'smtp_rejected' | 'smtp_timeout';

export class DeliveryError extends Error {
  constructor(readonly code: DeliveryErrorCode) {
    super(code);
  }
}
