-- Create discounts / promo codes table
CREATE TABLE IF NOT EXISTS discounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  description text,
  percent_off smallint CHECK (percent_off >= 0 AND percent_off <= 100),
  amount_off numeric(10,2) DEFAULT 0,
  starts_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  usage_limit int DEFAULT NULL,
  times_used int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discounts_updated_at ON discounts;
CREATE TRIGGER trg_discounts_updated_at
BEFORE UPDATE ON discounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
