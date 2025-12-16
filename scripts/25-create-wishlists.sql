-- 25-create-wishlists.sql
-- Creates a `wishlists` table compatible with the app's API endpoints
-- Notes:
--  - Creating the `pgcrypto` extension may require superuser or database owner privileges.
--  - If you cannot create extensions, ask your DB admin to create `pgcrypto` or use another uuid generator.

-- 1) Create extension used for gen_random_uuid (if available)
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
     -- This command may fail if the connected role is not allowed to create extensions
     PERFORM pg_catalog.create_extension('pgcrypto');
   END IF;
EXCEPTION WHEN others THEN
   -- ignore extension creation errors (will fallback if gen_random_uuid is not available)
   RAISE NOTICE 'pgcrypto extension not created or already present: %', SQLERRM;
END$$;

-- Also try to create uuid-ossp (provides uuid_generate_v4)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    PERFORM pg_catalog.create_extension('uuid-ossp');
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'uuid-ossp extension not created or already present: %', SQLERRM;
END$$;

-- 2) Create the wishlists table in the public schema (the app expects a table named `wishlists`)
-- Create the wishlists table using dynamic SQL so we can choose a supported UUID generator
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid') THEN
    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS public.wishlists (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        product_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT wishlists_user_product_unique UNIQUE (user_id, product_id)
      );
    $sql$;
  ELSIF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uuid_generate_v4') THEN
    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS public.wishlists (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        product_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT wishlists_user_product_unique UNIQUE (user_id, product_id)
      );
    $sql$;
  ELSE
    -- No UUID generator available; create table without a DEFAULT for `id`.
    -- Clients or application code must supply `id` in this case.
    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS public.wishlists (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        product_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT wishlists_user_product_unique UNIQUE (user_id, product_id)
      );
    $sql$;
  END IF;
END$$;

-- 3) Grant typical privileges to the `authenticated` role used by Supabase
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- 4) Ensure future tables get the same privileges for the `authenticated` role
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- If your deployment uses a different role or schema, adjust the `GRANT` and `SCHEMA` lines accordingly.
