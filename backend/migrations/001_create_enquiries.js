export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE enquiries (
      submission_id UUID PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      business_name VARCHAR(160),
      contact_info VARCHAR(254) NOT NULL,
      offer_type VARCHAR(24) NOT NULL CHECK (offer_type IN ('website_package', 'support_plan')),
      offer_id VARCHAR(32) NOT NULL,
      description TEXT NOT NULL,
      payload_hmac CHAR(64) NOT NULL CHECK (payload_hmac ~ '^[a-f0-9]{64}$'),
      status VARCHAR(24) NOT NULL DEFAULT 'received' CHECK (status IN ('received')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT enquiries_offer_type_id_check CHECK (
        (offer_type = 'website_package' AND offer_id IN ('business', 'starter', 'growth', 'pro', 'custom')) OR
        (offer_type = 'support_plan' AND offer_id IN ('care', 'support-growth', 'automation'))
      )
    );
    CREATE INDEX enquiries_created_at_idx ON enquiries (created_at DESC);
    CREATE INDEX enquiries_status_created_at_idx ON enquiries (status, created_at DESC);
  `);
}

export async function down(pgm) {
  pgm.sql('DROP TABLE IF EXISTS enquiries');
}
