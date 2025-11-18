-- Ensure premium_point_ledger has actor_user_id column referenced by reward RPCs
-- Safe to run multiple times; only adds the column if it is missing.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'premium_point_ledger'
      AND column_name = 'actor_user_id'
  ) THEN
    ALTER TABLE public.premium_point_ledger
      ADD COLUMN actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

COMMIT;
