import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { DeliveryErrorCode } from './sender.js';
import type { EnquiryDetails } from './template.js';

export const LEASE_SECONDS = 60;

export interface Claim extends EnquiryDetails {
  job_id: string;
  claim_token: string;
  attempt_count: number;
}

export async function claimNotification(pool: Pool, maxAttempts: number): Promise<Claim | undefined> {
  // Retire a bounded batch of exhausted jobs, skipping rows another worker is updating.
  await pool.query(`
    WITH exhausted AS (
      SELECT id FROM email_outbox
      WHERE attempt_count >= $1 AND (
        (status = 'processing' AND lease_expires_at <= statement_timestamp())
        OR status = 'pending'
      )
      LIMIT 50 FOR UPDATE SKIP LOCKED
    )
    UPDATE email_outbox AS job
    SET status = 'failed', locked_at = NULL, lease_expires_at = NULL, claim_token = NULL,
      last_error_code = CASE WHEN job.status = 'processing' THEN 'lease_expired'
        ELSE COALESCE(last_error_code, 'attempt_limit') END,
      updated_at = statement_timestamp()
    FROM exhausted WHERE job.id = exhausted.id
  `, [maxAttempts]);

  const result = await pool.query<Claim>(`
    WITH candidate AS (
      SELECT id FROM email_outbox
      WHERE attempt_count < $1 AND (
        (status = 'pending' AND available_at <= statement_timestamp())
        OR (status = 'processing' AND lease_expires_at <= statement_timestamp())
      )
      ORDER BY COALESCE(lease_expires_at, available_at), id
      LIMIT 1 FOR UPDATE SKIP LOCKED
    ), claimed AS (
      UPDATE email_outbox AS job
      SET status = 'processing', claim_token = $2, locked_at = statement_timestamp(),
        lease_expires_at = statement_timestamp() + $3::int * interval '1 second',
        attempt_count = attempt_count + 1, updated_at = statement_timestamp(),
        last_error_code = CASE WHEN job.status = 'processing' THEN 'lease_expired' ELSE last_error_code END
      FROM candidate WHERE job.id = candidate.id
      RETURNING job.id, job.enquiry_id, job.claim_token, job.attempt_count
    )
    SELECT claimed.id AS job_id, claimed.claim_token, claimed.attempt_count,
      enquiry.submission_id, enquiry.full_name, enquiry.business_name, enquiry.contact_info,
      enquiry.offer_type, enquiry.offer_id, enquiry.description, enquiry.created_at
    FROM claimed JOIN enquiries AS enquiry ON enquiry.submission_id = claimed.enquiry_id
  `, [maxAttempts, randomUUID(), LEASE_SECONDS]);
  return result.rows[0];
}

export function retryDelaySeconds(attempt: number): number {
  return Math.min(300, 5 * 2 ** (attempt - 1));
}

export async function finalizeNotification(
  pool: Pool,
  claim: Claim,
  maxAttempts: number,
  error?: DeliveryErrorCode,
): Promise<boolean> {
  const terminal = error === 'smtp_rejected' || claim.attempt_count >= maxAttempts;
  const status = error ? (terminal ? 'failed' : 'pending') : 'sent';
  const result = await pool.query(`
    UPDATE email_outbox
    SET status = $3,
      sent_at = CASE WHEN $3 = 'sent' THEN statement_timestamp() ELSE NULL END,
      available_at = CASE WHEN $3 = 'pending'
        THEN statement_timestamp() + $4::int * interval '1 second' ELSE available_at END,
      last_error_code = $5, claim_token = NULL, locked_at = NULL, lease_expires_at = NULL,
      updated_at = statement_timestamp()
    WHERE id = $1 AND claim_token = $2 AND status = 'processing'
      AND lease_expires_at > clock_timestamp()
  `, [claim.job_id, claim.claim_token, status, retryDelaySeconds(claim.attempt_count), error ?? null]);
  return result.rowCount === 1;
}
