-- Create mapping from PayWay transaction ids to orders for secure callbacks

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tran_id text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'initiated',
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Only admins can read; nobody can write directly except service functions
CREATE POLICY IF NOT EXISTS "Admins can read payment transactions"
  ON public.payment_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Allow owners to read only their own transaction status (optional)
CREATE POLICY IF NOT EXISTS "Users can read their own payment transactions"
  ON public.payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Function-based writes (service role) will manage inserts/updates.

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tran_id ON public.payment_transactions(tran_id);

