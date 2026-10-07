CREATE TABLE IF NOT EXISTS admin_login_failures (
  id BIGSERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_failures_created ON admin_login_failures (created_at);
