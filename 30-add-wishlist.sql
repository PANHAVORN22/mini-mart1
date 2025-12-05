-- 1) Create the schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS wishlist;

-- 2) Create extension(s) if needed (pgcrypto is common for gen_random_uuid)
-- Note: creating extensions may require superuser or owner privileges.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 3) Create tables inside wishlist schema
CREATE TABLE IF NOT EXISTS wishlist.button (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- If you have more wishlist tables, add them here. Example:
CREATE TABLE IF NOT EXISTS wishlist.item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  button_id uuid NOT NULL REFERENCES wishlist.button(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Optional: grant access to a role (replace some_role with the desired role)
-- Grant USAGE on the schema and typical privileges on tables
GRANT USAGE ON SCHEMA wishlist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA wishlist TO authenticated;

-- 5) Optional: ensure future tables get the same privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA wishlist GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;