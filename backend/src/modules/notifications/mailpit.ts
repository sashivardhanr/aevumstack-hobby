import { connect, isIP } from 'node:net';
import { once } from 'node:events';
import nodemailer from 'nodemailer';
import { DeliveryError, type NotificationSender } from './sender.js';

export const MAILPIT_RECIPIENT = 'enquiries@aevumstack.invalid';
const SMTP_TIMEOUT_MS = 15_000;

export function createMailpitSender({ host, port }: { host: string; port: number }): NotificationSender {
  if ((host !== '127.0.0.1' && host !== '::1') || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Mailpit requires a literal loopback address and a valid port');
  }

  return {
    async send(jobId, { subject, text, html }) {
      const socket = connect({ host, port, family: isIP(host) });
      // The transport and the connection promise handle failures. Keep a listener
      // on the socket during the handoff between them as well.
      socket.on('error', () => undefined);
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        socket.destroy(new Error('smtp_timeout'));
      }, SMTP_TIMEOUT_MS);

      try {
        await once(socket, 'connect');
        const transport = nodemailer.createTransport({
          host, port, connection: socket, secure: false, ignoreTLS: true,
          disableFileAccess: true, disableUrlAccess: true,
          logger: false, debug: false,
          connectionTimeout: SMTP_TIMEOUT_MS, greetingTimeout: SMTP_TIMEOUT_MS, socketTimeout: SMTP_TIMEOUT_MS,
        });
        const result = await transport.sendMail({
          from: 'notifications@aevumstack.invalid',
          to: MAILPIT_RECIPIENT,
          messageId: `<${jobId}@aevumstack.invalid>`,
          subject, text, html,
        });
        if (!result.accepted.includes(MAILPIT_RECIPIENT)) throw new DeliveryError('smtp_rejected');
      } catch (error) {
        if (error instanceof DeliveryError) throw error;
        const details = error as { responseCode?: number; code?: string } | null;
        if (timedOut || details?.code === 'ETIMEDOUT') throw new DeliveryError('smtp_timeout');
        if (typeof details?.responseCode === 'number' && details.responseCode >= 500) {
          throw new DeliveryError('smtp_rejected');
        }
        throw new DeliveryError('smtp_temporary');
      } finally {
        clearTimeout(timer);
        socket.destroy();
      }
    },
  };
}
