-- Analytics engine v2: source sequence metadata and incident classification

ALTER TABLE import_parsed_events
  ADD COLUMN IF NOT EXISTS source_row_number INTEGER,
  ADD COLUMN IF NOT EXISTS source_sequence INTEGER,
  ADD COLUMN IF NOT EXISTS source_event_id TEXT,
  ADD COLUMN IF NOT EXISTS source_system TEXT DEFAULT 'genetec',
  ADD COLUMN IF NOT EXISTS site TEXT;

ALTER TABLE import_incidents
  ADD COLUMN IF NOT EXISTS classification TEXT,
  ADD COLUMN IF NOT EXISTS trace_data JSONB,
  ADD COLUMN IF NOT EXISTS analytics_engine_version TEXT;

ALTER TABLE imports
  ADD COLUMN IF NOT EXISTS analytics_engine_version TEXT,
  ADD COLUMN IF NOT EXISTS analytics_threshold_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_import_parsed_events_door_timestamp
  ON import_parsed_events (door, event_timestamp);

CREATE INDEX IF NOT EXISTS idx_import_incidents_classification
  ON import_incidents (classification);
