-- Inbound email ingestion schema for Exit Compliance Pro

CREATE TABLE IF NOT EXISTS inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_email_id TEXT NOT NULL UNIQUE,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  received_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('processing', 'processed', 'rejected', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('manual_upload', 'inbound_email')),
  file_name TEXT NOT NULL,
  original_file_path TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  column_count INTEGER NOT NULL DEFAULT 0,
  headers JSONB NOT NULL DEFAULT '[]'::jsonb,
  field_mapping JSONB,
  analysis_snapshot JSONB,
  status TEXT NOT NULL CHECK (
    status IN ('processing', 'processed', 'rejected', 'failed', 'ready_for_mapping', 'mapped')
  ),
  inbound_email_id UUID REFERENCES inbound_emails(id) ON DELETE SET NULL,
  processing_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_created_at ON inbound_emails (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_status ON inbound_emails (status);
CREATE INDEX IF NOT EXISTS idx_imports_created_at ON imports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imports_source ON imports (source);
CREATE INDEX IF NOT EXISTS idx_imports_inbound_email_id ON imports (inbound_email_id);
