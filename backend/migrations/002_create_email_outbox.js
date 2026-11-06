export function up(pgm) {
  pgm.sql(`
    CREATE TABLE email_outbox (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enquiry_id UUID NOT NULL REFERENCES enquiries(submission_id),
      notification_type TEXT NOT NULL DEFAULT 'enquiry_received'
        CHECK (notification_type = 'enquiry_received'),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      locked_at TIMESTAMPTZ,
      lease_expires_at TIMESTAMPTZ,
      claim_token UUID,
      sent_at TIMESTAMPTZ,
      last_error_code TEXT CHECK (last_error_code IN ('smtp_temporary', 'smtp_rejected', 'smtp_timeout', 'lease_expired', 'attempt_limit')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (enquiry_id, notification_type),
      CHECK (
        (status = 'processing' AND locked_at IS NOT NULL AND lease_expires_at IS NOT NULL
          AND claim_token IS NOT NULL AND lease_expires_at > locked_at)
        OR (status <> 'processing' AND locked_at IS NULL AND lease_expires_at IS NULL AND claim_token IS NULL)
      ),
      CHECK ((status = 'sent') = (sent_at IS NOT NULL))
    );
    CREATE INDEX email_outbox_pending_idx ON email_outbox (available_at, id) WHERE status = 'pending';
    CREATE INDEX email_outbox_lease_idx ON email_outbox (lease_expires_at, id) WHERE status = 'processing';
  `);
}

export function down() {
  throw new Error('The email outbox migration is forward-only');
}
