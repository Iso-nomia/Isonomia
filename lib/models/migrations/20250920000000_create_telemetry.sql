CREATE TABLE telemetry (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  coords TEXT NOT NULL,
  user_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX telemetry_event_created_at_idx
  ON telemetry (event, created_at);
