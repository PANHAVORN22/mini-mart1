-- Premium rewards & loyalty migration
-- Creates reward catalog, redemption tracking, point ledger, and helper RPCs.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reward catalog -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.premium_reward_items (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	name TEXT NOT NULL,
	description TEXT,
	points_cost INTEGER NOT NULL CHECK (points_cost > 0),
	stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
	image_url TEXT,
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_premium_reward_items_active
	ON public.premium_reward_items (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_premium_reward_items_points
	ON public.premium_reward_items (points_cost);

CREATE OR REPLACE FUNCTION public.set_premium_reward_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_premium_reward_items_updated_at
	ON public.premium_reward_items;
CREATE TRIGGER trg_premium_reward_items_updated_at
BEFORE UPDATE ON public.premium_reward_items
FOR EACH ROW
EXECUTE FUNCTION public.set_premium_reward_items_updated_at();

ALTER TABLE public.premium_reward_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view premium rewards"
	ON public.premium_reward_items;
CREATE POLICY "Public can view premium rewards"
	ON public.premium_reward_items
	FOR SELECT
	USING (TRUE);

DROP POLICY IF EXISTS "Admins manage premium rewards"
	ON public.premium_reward_items;
CREATE POLICY "Admins manage premium rewards"
	ON public.premium_reward_items
	FOR ALL
	TO authenticated
	USING (
		EXISTS (
			SELECT 1 FROM public.users
			WHERE id = auth.uid()
				AND role = 'admin'
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM public.users
			WHERE id = auth.uid()
				AND role = 'admin'
		)
	);

-- Point ledger -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.premium_point_ledger (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
	actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
	delta INTEGER NOT NULL,
	reason TEXT NOT NULL,
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_premium_point_ledger_user
	ON public.premium_point_ledger (user_id, created_at DESC);

ALTER TABLE public.premium_point_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their point ledger"
	ON public.premium_point_ledger;
CREATE POLICY "Users can view their point ledger"
	ON public.premium_point_ledger
	FOR SELECT
	USING (auth.uid() = user_id);

-- Redemption tracking -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.premium_reward_redemptions (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	reward_id UUID NOT NULL REFERENCES public.premium_reward_items(id) ON DELETE RESTRICT,
	user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
	points_spent INTEGER NOT NULL CHECK (points_spent > 0),
	quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 5),
	status TEXT NOT NULL DEFAULT 'pending'
		CHECK (status IN ('pending','preparing','ready','picked_up','cancelled')),
	verification_code TEXT NOT NULL UNIQUE,
	contact_phone TEXT NOT NULL,
	address_line1 TEXT NOT NULL,
	address_line2 TEXT,
	city TEXT,
	postal_code TEXT,
	additional_notes TEXT,
	admin_notes TEXT,
	admin_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	fulfilled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_premium_reward_redemptions_user
	ON public.premium_reward_redemptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_premium_reward_redemptions_status
	ON public.premium_reward_redemptions (status);

CREATE OR REPLACE FUNCTION public.set_premium_reward_redemptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_premium_reward_redemptions_updated_at
	ON public.premium_reward_redemptions;
CREATE TRIGGER trg_premium_reward_redemptions_updated_at
BEFORE UPDATE ON public.premium_reward_redemptions
FOR EACH ROW
EXECUTE FUNCTION public.set_premium_reward_redemptions_updated_at();

ALTER TABLE public.premium_reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their redemptions"
	ON public.premium_reward_redemptions;
CREATE POLICY "Users can view their redemptions"
	ON public.premium_reward_redemptions
	FOR SELECT
	USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage redemptions"
	ON public.premium_reward_redemptions;
CREATE POLICY "Admins manage redemptions"
	ON public.premium_reward_redemptions
	FOR ALL
	TO authenticated
	USING (
		EXISTS (
			SELECT 1 FROM public.users
			WHERE id = auth.uid()
				AND role = 'admin'
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM public.users
			WHERE id = auth.uid()
				AND role = 'admin'
		)
	);

-- Helper RPCs --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adjust_premium_points(
	target_user UUID,
	delta INTEGER,
	reason TEXT DEFAULT 'Manual adjustment'
) RETURNS TABLE (new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	caller UUID := auth.uid();
	caller_role TEXT;
	sanitized_reason TEXT := NULLIF(COALESCE(reason, ''), '');
	balance INTEGER;
BEGIN
	IF caller IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT role INTO caller_role
	FROM public.users
	WHERE id = caller;

	IF caller_role IS DISTINCT FROM 'admin' THEN
		RAISE EXCEPTION 'Forbidden';
	END IF;

	IF delta IS NULL OR delta = 0 THEN
		RAISE EXCEPTION 'delta must be a non-zero integer';
	END IF;

	UPDATE public.users
		 SET premium_points = GREATEST(0, COALESCE(premium_points, 0) + delta)
	 WHERE id = target_user
	 RETURNING premium_points INTO balance;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Target user not found';
	END IF;

	INSERT INTO public.premium_point_ledger (
		user_id,
		actor_user_id,
		delta,
		reason,
		metadata
	) VALUES (
		target_user,
		caller,
		delta,
		COALESCE(sanitized_reason, 'Manual adjustment'),
		jsonb_build_object('source', 'admin_adjustment')
	);

	RETURN QUERY SELECT balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_premium_reward(
	reward_id UUID,
	quantity INTEGER,
	contact_phone TEXT,
	address_line1 TEXT,
	address_line2 TEXT,
	city TEXT,
	postal_code TEXT,
	additional_notes TEXT
) RETURNS TABLE (
	redemption_id UUID,
	new_balance INTEGER,
	verification_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	caller UUID := auth.uid();
	user_row public.users%ROWTYPE;
	reward_row public.premium_reward_items%ROWTYPE;
	total_cost INTEGER;
	updated_balance INTEGER;
	verification TEXT;
BEGIN
	IF caller IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	IF quantity IS NULL THEN
		quantity := 1;
	END IF;

	IF quantity <= 0 OR quantity > 5 THEN
		RAISE EXCEPTION 'Quantity must be between 1 and 5';
	END IF;

	IF contact_phone IS NULL OR btrim(contact_phone) = '' THEN
		RAISE EXCEPTION 'Contact phone required';
	END IF;

	IF address_line1 IS NULL OR btrim(address_line1) = '' THEN
		RAISE EXCEPTION 'Address line 1 required';
	END IF;

	SELECT * INTO user_row
		FROM public.users
	 WHERE id = caller
	 FOR UPDATE;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'User profile missing';
	END IF;

	IF NOT COALESCE(user_row.is_premium, FALSE) THEN
		RAISE EXCEPTION 'Premium membership required';
	END IF;

	SELECT * INTO reward_row
		FROM public.premium_reward_items
	 WHERE id = reward_id
	 FOR UPDATE;

	IF NOT FOUND OR NOT reward_row.is_active THEN
		RAISE EXCEPTION 'Reward unavailable';
	END IF;

	IF reward_row.stock < quantity THEN
		RAISE EXCEPTION 'Insufficient reward stock';
	END IF;

	total_cost := reward_row.points_cost * quantity;

	IF COALESCE(user_row.premium_points, 0) < total_cost THEN
		RAISE EXCEPTION 'Not enough premium points';
	END IF;

	UPDATE public.premium_reward_items
		 SET stock = stock - quantity
	 WHERE id = reward_id;

	UPDATE public.users
		 SET premium_points = premium_points - total_cost
	 WHERE id = caller
	 RETURNING premium_points INTO updated_balance;

	INSERT INTO public.premium_point_ledger (
		user_id,
		actor_user_id,
		delta,
		reason,
		metadata
	) VALUES (
		caller,
		caller,
		-total_cost,
		'Reward redemption',
		jsonb_build_object('reward_id', reward_id, 'quantity', quantity)
	);

	verification := upper(encode(gen_random_bytes(4), 'hex'));

	INSERT INTO public.premium_reward_redemptions (
		reward_id,
		user_id,
		points_spent,
		quantity,
		verification_code,
		contact_phone,
		address_line1,
		address_line2,
		city,
		postal_code,
		additional_notes,
		metadata
	) VALUES (
		reward_id,
		caller,
		total_cost,
		quantity,
		verification,
		contact_phone,
		address_line1,
		address_line2,
		city,
		postal_code,
		additional_notes,
		jsonb_build_object('source', 'self_service')
	)
	RETURNING id INTO redemption_id;

	RETURN QUERY SELECT redemption_id, updated_balance, verification;
END;
$$;

-- Seed data ---------------------------------------------------------------

INSERT INTO public.premium_reward_items (name, description, points_cost, stock, image_url, is_active)
VALUES
	('VIP tasting kit', 'Curated selection of premium bottles for members-only tastings.', 250, 10, '/rewards/vip-tasting-kit.jpg', TRUE),
	('Chilled delivery credit', 'Waives the chilled-delivery surcharge on the next order.', 120, 25, '/rewards/chilled-delivery.jpg', TRUE),
	('Limited glassware set', 'Pair of etched tulip glasses for cellar releases.', 300, 8, '/rewards/glassware-set.jpg', TRUE)
ON CONFLICT DO NOTHING;