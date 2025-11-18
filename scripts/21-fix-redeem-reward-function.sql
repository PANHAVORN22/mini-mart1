-- Consolidates redeem_premium_reward function definitions and removes the
-- dependency on pgcrypto/gen_random_bytes so the RPC can run on free-tier
-- Postgres instances.

BEGIN;

-- Clean up any legacy overloads that may exist in the database.
DROP FUNCTION IF EXISTS public.redeem_premium_reward(
	uuid,
	integer,
	text,
	text,
	text,
	text,
	text,
	text
);

DROP FUNCTION IF EXISTS public.redeem_premium_reward(
	uuid,
	integer,
	text,
	text,
	text,
	text,
	text
);

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
	sanitized_quantity INTEGER := COALESCE(quantity, 1);
	sanitized_phone TEXT := NULLIF(btrim(contact_phone), '');
	sanitized_address1 TEXT := NULLIF(btrim(address_line1), '');
	sanitized_address2 TEXT := NULLIF(btrim(address_line2), '');
	sanitized_city TEXT := NULLIF(btrim(city), '');
	sanitized_postal TEXT := NULLIF(btrim(postal_code), '');
	sanitized_notes TEXT := NULLIF(btrim(additional_notes), '');
BEGIN
	IF caller IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	IF sanitized_quantity <= 0 OR sanitized_quantity > 5 THEN
		RAISE EXCEPTION 'Quantity must be between 1 and 5';
	END IF;

	IF sanitized_phone IS NULL THEN
		RAISE EXCEPTION 'Contact phone required';
	END IF;

	IF sanitized_address1 IS NULL THEN
		RAISE EXCEPTION 'Address line 1 required';
	END IF;

	SELECT *
		INTO user_row
		FROM public.users
	 WHERE id = caller
	 FOR UPDATE;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'User profile missing';
	END IF;

	IF NOT COALESCE(user_row.is_premium, FALSE) THEN
		RAISE EXCEPTION 'Premium membership required';
	END IF;

	SELECT *
		INTO reward_row
		FROM public.premium_reward_items
	 WHERE id = reward_id
	 FOR UPDATE;

	IF NOT FOUND OR NOT reward_row.is_active THEN
		RAISE EXCEPTION 'Reward unavailable';
	END IF;

	IF reward_row.stock < sanitized_quantity THEN
		RAISE EXCEPTION 'Insufficient reward stock';
	END IF;

	total_cost := reward_row.points_cost * sanitized_quantity;

	IF COALESCE(user_row.premium_points, 0) < total_cost THEN
		RAISE EXCEPTION 'Not enough premium points';
	END IF;

	UPDATE public.premium_reward_items
		 SET stock = stock - sanitized_quantity
	 WHERE id = reward_id;

	UPDATE public.users
		 SET premium_points = GREATEST(0, COALESCE(premium_points, 0) - total_cost)
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
		jsonb_build_object('reward_id', reward_id, 'quantity', sanitized_quantity)
	);

	verification := upper(substr(md5(random()::text || clock_timestamp()::text || caller::text), 1, 8));

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
		sanitized_quantity,
		verification,
		sanitized_phone,
		sanitized_address1,
		sanitized_address2,
		sanitized_city,
		sanitized_postal,
		sanitized_notes,
		jsonb_build_object('source', 'self_service')
	)
	RETURNING id INTO redemption_id;

	RETURN QUERY SELECT redemption_id, updated_balance, verification;
END;
$$;

COMMIT;
