import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import type { FastifyLoggerStreamDestination } from 'fastify/types/logger.js';
import type { Server } from 'node:http';
import type { AppConfig } from './config/env.js';
import { acceptEnquiry } from './modules/enquiries/service.js';
import { enquiryRequestSchema } from './modules/enquiries/schema.js';
import { LocalRateLimiter } from './plugins/rate-limit.js';
import { registerStaticSite } from './plugins/static-site.js';

export const REQUEST_BODY_LIMIT = 32 * 1024;
const REQUEST_BODY_TIMEOUT_MS = 5_000;

interface AppDependencies {
  config: AppConfig;
  pool: Pool;
  onClose?: () => Promise<void>;
  loggerStream?: FastifyLoggerStreamDestination;
  staticRoot?: string;
}

function errorBody(code: string): { error: string } {
  return { error: code };
}

function isJsonRequest(request: { headers: { 'content-type'?: string | string[] } }): boolean {
  const contentType = request.headers['content-type'];
  if (typeof contentType !== 'string') return false;
  const [mediaType, ...parameters] = contentType.split(';');
  if (mediaType.trim().toLowerCase() !== 'application/json') return false;
  return parameters.length <= 1 && parameters.every((parameter) => /^charset\s*=\s*(?:utf-8|"utf-8")$/i.test(parameter.trim()));
}

function hasAllowedOrigin(request: { headers: { origin?: string | string[] } }, config: AppConfig): boolean {
  const origin = request.headers.origin;
  if (typeof origin !== 'string') return false;
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && config.allowedOrigins.has(origin);
  } catch {
    return false;
  }
}

type AppInstance = FastifyInstance<Server>;

function applySecurityHeaders(reply: FastifyReply): void {
  reply.header('cache-control', 'no-store');
  reply.header('x-content-type-options', 'nosniff');
  reply.header('x-frame-options', 'DENY');
  reply.header('referrer-policy', 'no-referrer');
  reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
}

export function buildApp({ config, pool, onClose, loggerStream, staticRoot }: AppDependencies): AppInstance {
  const app = Fastify<Server>({
    bodyLimit: REQUEST_BODY_LIMIT,
    trustProxy: false,
    frameworkErrors(error, _request, reply) {
      // Routing errors happen before the regular request hooks.
      applySecurityHeaders(reply);
      const status = error.code === 'FST_ERR_BAD_URL' ? 400 : error.code === 'FST_ERR_MAX_PARAM_LENGTH' ? 414 : 500;
      const response: FastifyReply = reply;
      return response.code(status).send(errorBody(status === 500 ? 'internal_error' : 'invalid_request'));
    },
    logController: new Fastify.LogController({ disableRequestLogging: true }),
    logger: {
      level: 'info',
      ...(loggerStream ? { stream: loggerStream } : {}),
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.set-cookie', 'req.body', 'res.headers.set-cookie'],
        censor: '[REDACTED]',
      },
    },
  });
  // Validate the actual bytes before using Fastify's prototype-poisoning checks.
  const decodeJson = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const parseJson = app.getDefaultJsonParser('error', 'error');
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser<Buffer>('application/json', { parseAs: 'buffer' }, (request, body, done) => {
    let text: string;
    try {
      text = decodeJson.decode(body);
    } catch {
      done(Object.assign(new Error('Invalid JSON encoding'), { statusCode: 400 }));
      return;
    }
    parseJson(request, text, done);
  });

  const limiter = new LocalRateLimiter(config.rateLimitMax, config.rateLimitWindowMs);

  app.addHook('onRequest', async (_request, reply) => applySecurityHeaders(reply));
  app.setNotFoundHandler(async (_request, reply) => reply.code(404).send(errorBody('not_found')));
  app.addHook('onClose', async () => {
    if (onClose) await onClose();
    else await pool.end();
  });

  app.setErrorHandler((error, request, reply) => {
    const errorObject = typeof error === 'object' && error !== null ? error : undefined;
    const statusCode = errorObject && 'statusCode' in errorObject && typeof errorObject.statusCode === 'number' ? errorObject.statusCode : 500;
    const errorCode = errorObject && 'code' in errorObject && typeof errorObject.code === 'string' ? errorObject.code : 'unexpected_error';
    if (statusCode === 413) return reply.code(413).send(errorBody('request_too_large'));
    if (statusCode === 400) return reply.code(400).send(errorBody('invalid_request'));
    request.log.error({ event: 'request.failed', code: errorCode }, 'Request could not be completed');
    return reply.code(500).send(errorBody('internal_error'));
  });

  app.get('/api/health/live', async (_request, reply) => reply.code(200).send({ status: 'alive' }));

  app.get('/api/health/ready', async (_request, reply) => {
    try {
      await pool.query('SELECT 1 FROM email_outbox LIMIT 0');
      return reply.code(200).send({ status: 'ready' });
    } catch {
      return reply.code(503).send({ status: 'not_ready' });
    }
  });

  app.post('/api/v1/enquiries', {
    async preParsing(request, reply, body) {
      // Bound body ingestion separately from database work after parsing.
      const timeout = setTimeout(() => {
        void reply.header('connection', 'close').code(408).send(errorBody('request_timeout'));
      }, REQUEST_BODY_TIMEOUT_MS);
      const clear = () => clearTimeout(timeout);
      body.once('end', clear);
      body.once('close', clear);
      reply.raw.once('finish', clear);
      return body;
    },
    async onRequest(request, reply) {
      // Reject foreign or unsupported requests before Fastify reads/parses their body.
      if (!hasAllowedOrigin(request, config)) {
        return reply.code(403).send(errorBody('origin_not_allowed'));
      }
      if (!isJsonRequest(request)) return reply.code(415).send(errorBody('json_required'));
      const encoding = request.headers['content-encoding'];
      if (encoding !== undefined && encoding.toLowerCase() !== 'identity') {
        return reply.code(415).send(errorBody('unsupported_content_encoding'));
      }

      // The server is loopback-bound. Do not use X-Forwarded-For or client-supplied identifiers.
      const rate = limiter.consume(request.socket.remoteAddress ?? 'unknown');
      if (!rate.allowed) {
        reply.header('retry-after', String(rate.retryAfterSeconds));
        return reply.code(429).send(errorBody('rate_limited'));
      }
    },
  }, async (request, reply) => {
    const parsed = enquiryRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const honeypot = parsed.error.issues.some((issue) => issue.path[0] === 'website');
      request.log.warn({ event: 'enquiry.rejected', reason: honeypot ? 'spam_field' : 'validation' }, 'Enquiry request rejected');
      return reply.code(400).send(errorBody(honeypot ? 'request_rejected' : 'invalid_request'));
    }

    try {
      const result = await acceptEnquiry(pool, config.idempotencyHmacKey, parsed.data);
      if (result === 'conflict') return reply.code(409).send(errorBody('submission_conflict'));
      return reply.code(202).send({
        accepted: true,
        submissionId: parsed.data.submissionId,
        status: 'received',
      });
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'database_unavailable';
      request.log.error({ event: 'enquiry.persistence_failed', code }, 'Enquiry could not be persisted');
      return reply.code(503).send(errorBody('temporarily_unavailable'));
    }
  });

  if (staticRoot) registerStaticSite(app, staticRoot);
  return app;
}
