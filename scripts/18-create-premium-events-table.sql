-- Creates the premium_events table used by the admin dashboard and premium landing page.
-- Run this in the Supabase SQL editor (or via the CLI) before attempting to manage premium campaigns.

CREATE TABLE IF NOT EXISTS public.premium_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  banner_url TEXT,
  discount_percentage NUMERIC(5, 2),
  featured_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  stock_limit INTEGER NOT NULL DEFAULT 0 CHECK (stock_limit >= 0),
  stock_remaining INTEGER NOT NULL DEFAULT 0 CHECK (stock_remaining >= 0),
  audience TEXT NOT NULL DEFAULT 'premium' CHECK (audience IN ('premium', 'all')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT premium_events_stock_remaining_check CHECK (stock_remaining <= stock_limit)
);

CREATE INDEX IF NOT EXISTS idx_premium_events_status ON public.premium_events (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_premium_events_audience ON public.premium_events (audience);

-- Basic updated_at trigger so the timestamps stay fresh.
CREATE OR REPLACE FUNCTION public.set_premium_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_premium_events_updated_at ON public.premium_events;
CREATE TRIGGER trg_premium_events_updated_at
BEFORE UPDATE ON public.premium_events
FOR EACH ROW
EXECUTE FUNCTION public.set_premium_events_updated_at();

ALTER TABLE public.premium_events ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read the campaigns, but only admins can mutate them.
DROP POLICY IF EXISTS "Anyone can view premium events" ON public.premium_events;
CREATE POLICY "Anyone can view premium events" ON public.premium_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage premium events" ON public.premium_events;
CREATE POLICY "Admins manage premium events" ON public.premium_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins update premium events" ON public.premium_events;
CREATE POLICY "Admins update premium events" ON public.premium_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins delete premium events" ON public.premium_events;
CREATE POLICY "Admins delete premium events" ON public.premium_events
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Optional starter data to verify the UI quickly.
INSERT INTO public.premium_events (
  title,
  description,
  starts_at,
  ends_at,
  banner_url,
  discount_percentage,
  audience,
  stock_limit,
  stock_remaining
) VALUES
  (
    'Winter Cellar Drop',
    'Limited barrel-aged bottles rotate in daily while supplies last.',
    NOW() - INTERVAL '2 day',
    NOW() + INTERVAL '5 day',
    '/premium-cellar.jpg',
    15,
    'premium',
    120,
    45
  ),
  (
    'Energy Boost Weekend',
    'Stock up on premium energy drinks and get free chilled delivery.',
    NOW() + INTERVAL '3 day',
    NOW() + INTERVAL '6 day',
    '/premium-energy-weekend.jpg',
    10,
    'premium',
    80,
    80
  )
ON CONFLICT DO NOTHING;
