-- Consolidated security migration: re-enable RLS and secure the auth trigger
-- NOTE: Run this in the Supabase SQL editor in your project. It is safe to run
-- multiple times. It replaces any previous insecure policies introduced by
-- earlier experimental scripts (07-10).
-- This file does NOT make any role or user changes beyond policy enforcement.

-- 1) Secure the signup trigger: never trust raw_user_meta_data for role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'customer'           -- always default to customer; admins are provisioned out-of-band
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END
$fn$;

-- Ensure the trigger exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 2) Re-enable RLS on core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 3) Remove any permissive/insecure policies that may exist
DO $clean$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.schemaname, p.tablename, p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.policyname IN (
        'Allow all operations on users',
        'users_select_policy',
        'users_insert_policy',
        'users_update_policy'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END
$clean$;

-- 4) Users table policies (self-only except admin)
CREATE POLICY IF NOT EXISTS "Users can view their own profile"
  ON public.users FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update their own profile"
  ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Admins can view all users"
  ON public.users FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY IF NOT EXISTS "Admins can update all users"
  ON public.users FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 5) Beers + Products: public read, admin write
CREATE POLICY IF NOT EXISTS "Anyone can view beers"
  ON public.beers FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Admins can insert beers"
  ON public.beers FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY IF NOT EXISTS "Admins can update beers"
  ON public.beers FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY IF NOT EXISTS "Admins can delete beers"
  ON public.beers FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY IF NOT EXISTS "Anyone can view products"
  ON public.products FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Admins can insert products"
  ON public.products FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY IF NOT EXISTS "Admins can update products"
  ON public.products FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY IF NOT EXISTS "Admins can delete products"
  ON public.products FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 6) Orders and order_items: user-owned visibility + admin access
CREATE POLICY IF NOT EXISTS "Users can view their own orders"
  ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can create their own orders"
  ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Admins can view all orders"
  ON public.orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY IF NOT EXISTS "Admins can update all orders"
  ON public.orders FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY IF NOT EXISTS "Users can view their own order items"
  ON public.order_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );
CREATE POLICY IF NOT EXISTS "Users can create order items for their orders"
  ON public.order_items FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );
CREATE POLICY IF NOT EXISTS "Admins can view all order items"
  ON public.order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 7) Subscriptions: user-owned visibility + admin access
CREATE POLICY IF NOT EXISTS "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can create their own subscriptions"
  ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY IF NOT EXISTS "Admins can update all subscriptions"
  ON public.subscriptions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 8) Optional: backfill profiles for existing auth users (role defaults to customer)
INSERT INTO public.users (id, email, full_name, role)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  'customer'
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;

