-- Creates a helper RPC that service-role code can use to award premium points
-- atomically while logging the ledger event. Only the service_role may invoke it.

CREATE OR REPLACE FUNCTION public.service_award_purchase_points(
  target_user UUID,
  points INTEGER,
  reason TEXT DEFAULT 'Order purchase',
  metadata JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE (new_balance INTEGER) AS $$
DECLARE
  request_role TEXT := current_setting('request.jwt.claim.role', true);
  user_row public.users%ROWTYPE;
BEGIN
  IF request_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_award_purchase_points is restricted to the service role';
  END IF;

  IF points IS NULL OR points <= 0 THEN
    RAISE EXCEPTION 'Points must be a positive integer';
  END IF;

  SELECT *
    INTO user_row
    FROM public.users
   WHERE id = target_user
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  IF NOT user_row.is_premium THEN
    RETURN QUERY SELECT user_row.premium_points;
    RETURN;
  END IF;

  UPDATE public.users
     SET premium_points = premium_points + points
   WHERE id = target_user;

  INSERT INTO public.premium_point_ledger (user_id, delta, reason, metadata)
  VALUES (target_user, points, reason, metadata);

  RETURN QUERY
  SELECT premium_points
    FROM public.users
   WHERE id = target_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
