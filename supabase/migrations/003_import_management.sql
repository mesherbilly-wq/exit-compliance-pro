-- Import Management: normalized analytics tables and extended import metadata

ALTER TABLE imports
  ADD COLUMN IF NOT EXISTS reporting_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reporting_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS sender TEXT,
  ADD COLUMN IF NOT EXISTS door_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incident_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compliance_score_snapshot NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS processing_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS error_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_csv_path TEXT,
  ADD COLUMN IF NOT EXISTS failed_csv_retention_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_analytics BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_duration_field BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS import_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  door TEXT NOT NULL,
  start_timestamp BIGINT NOT NULL,
  end_timestamp BIGINT NOT NULL,
  start_time_label TEXT NOT NULL,
  end_time_label TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  threshold_seconds INTEGER NOT NULL,
  time_beyond_threshold_seconds INTEGER NOT NULL,
  risk_rating TEXT NOT NULL,
  duration_bucket TEXT NOT NULL,
  day_started TEXT NOT NULL,
  hour_started INTEGER NOT NULL,
  is_explicit_alarm BOOLEAN NOT NULL DEFAULT FALSE,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_hourly_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  door TEXT NOT NULL,
  hour_label TEXT NOT NULL,
  incident_count INTEGER NOT NULL DEFAULT 0,
  exposure_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_daily_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  door TEXT NOT NULL,
  day_label TEXT NOT NULL,
  incident_count INTEGER NOT NULL DEFAULT 0,
  exposure_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_door_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  door TEXT NOT NULL,
  compliance_score INTEGER NOT NULL,
  compliance_rating TEXT NOT NULL,
  total_incidents INTEGER NOT NULL DEFAULT 0,
  total_fire_exit_events INTEGER NOT NULL DEFAULT 0,
  total_exposure_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (import_id, door)
);

CREATE TABLE IF NOT EXISTS import_parsed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  door TEXT NOT NULL,
  event_time TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_timestamp BIGINT NOT NULL,
  csv_duration_seconds NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_incidents_import_id ON import_incidents (import_id);
CREATE INDEX IF NOT EXISTS idx_import_incidents_door ON import_incidents (door);
CREATE INDEX IF NOT EXISTS idx_import_hourly_statistics_import_id ON import_hourly_statistics (import_id);
CREATE INDEX IF NOT EXISTS idx_import_daily_statistics_import_id ON import_daily_statistics (import_id);
CREATE INDEX IF NOT EXISTS idx_import_door_compliance_import_id ON import_door_compliance (import_id);
CREATE INDEX IF NOT EXISTS idx_import_parsed_events_import_id ON import_parsed_events (import_id);
CREATE INDEX IF NOT EXISTS idx_imports_failed_csv_retention ON imports (failed_csv_retention_until)
  WHERE failed_csv_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_imports_has_analytics ON imports (has_analytics, created_at DESC);
