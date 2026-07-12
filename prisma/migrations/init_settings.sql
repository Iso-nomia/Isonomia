-- USER SETTINGS (one row per user)
CREATE TABLE user_settings (
  user_id  bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  prefs    jsonb       NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- WORKSPACE SETTINGS (one row per workspace / site)
CREATE TABLE workspace_settings (
  workspace_id bigint PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  prefs        jsonb  NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now()
);
