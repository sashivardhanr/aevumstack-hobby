import { z } from 'zod';

const smtpSettings = new Set(['SMTP_HOST', 'SMTP_PORT']);

export function loadWorkerConfig(environment: NodeJS.ProcessEnv) {
  if (Object.keys(environment).some((key) => /^SMTP_/i.test(key) && !smtpSettings.has(key))) {
    throw new Error('Only the local SMTP host and port may be configured');
  }

  const parsed = z.object({
    SMTP_HOST: z.enum(['127.0.0.1', '::1']).default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
    OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  }).safeParse(environment);
  if (!parsed.success) throw new Error('Invalid local worker configuration');

  return {
    smtp: { host: parsed.data.SMTP_HOST, port: parsed.data.SMTP_PORT },
    maxAttempts: parsed.data.OUTBOX_MAX_ATTEMPTS,
  };
}
