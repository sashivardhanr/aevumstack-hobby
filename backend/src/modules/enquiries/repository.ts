import type { Pool, PoolClient } from 'pg';
import { hmacMatches } from './idempotency.js';
import type { NormalizedEnquiry } from './schema.js';

export type PersistResult = { kind: 'accepted' } | { kind: 'conflict' };

export async function persistEnquiry(pool: Pool, submissionId: string, enquiry: NormalizedEnquiry, hmac: string): Promise<PersistResult> {
  const client: PoolClient = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;

    const inserted = await client.query(
      `INSERT INTO enquiries (
        submission_id, full_name, business_name, contact_info,
        offer_type, offer_id, description, payload_hmac, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'received')
      ON CONFLICT (submission_id) DO NOTHING
      RETURNING submission_id`,
      [submissionId, enquiry.fullName, enquiry.businessName, enquiry.contactInfo, enquiry.offerType, enquiry.offerId, enquiry.description, hmac],
    );

    if (inserted.rowCount === 1) {
      await client.query('INSERT INTO email_outbox (enquiry_id) VALUES ($1)', [submissionId]);
      await client.query('COMMIT');
      inTransaction = false;
      return { kind: 'accepted' };
    }

    const existing = await client.query<{ payload_hmac: string }>(
      'SELECT payload_hmac FROM enquiries WHERE submission_id = $1 FOR UPDATE',
      [submissionId],
    );
    if (!existing.rows[0]) throw new Error('idempotency_record_missing');

    const matches = hmacMatches(existing.rows[0].payload_hmac, hmac);
    await client.query(matches ? 'COMMIT' : 'ROLLBACK');
    inTransaction = false;
    return matches ? { kind: 'accepted' } : { kind: 'conflict' };
  } catch (error) {
    if (inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The original failure is the relevant result; never log the query payload or driver message.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
