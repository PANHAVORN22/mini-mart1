-- SQL migration to create a transaction-safe order creation function
-- Run this on your Postgres (Supabase) database as a migration.

CREATE OR REPLACE FUNCTION public.create_order_transaction(
  p_user_id uuid,
  p_items jsonb,
  p_checkout jsonb
)
RETURNS TABLE(success boolean, order_id uuid, error_text text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total numeric := 0;
  v_order_id uuid;
  v_item jsonb;
  v_beer_id uuid;
  v_qty int;
  v_price numeric;
  v_stock int;
  v_insufficient jsonb := '[]'::jsonb;
BEGIN
  -- Ensure the caller is creating an order for themselves. This prevents
  -- admins or malicious clients from spoofing user ids when the function runs
  -- with elevated privileges.
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Caller does not match authenticated user';
  END IF;

  -- Calculate total and verify stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_beer_id := (v_item->>'beerId')::uuid;
    v_qty := (v_item->>'quantity')::int;
    v_price := (v_item->>'price')::numeric;

    SELECT stock INTO v_stock FROM beers WHERE id = v_beer_id FOR UPDATE;

    IF NOT FOUND THEN
      v_insufficient := v_insufficient || jsonb_build_object('beerId', v_beer_id, 'name', v_beer_id, 'available', 0, 'requested', v_qty);
    ELSE
      IF v_stock < v_qty THEN
        v_insufficient := v_insufficient || jsonb_build_object('beerId', v_beer_id, 'name', v_beer_id, 'available', v_stock, 'requested', v_qty);
      END IF;
    END IF;

    v_total := v_total + (v_price * v_qty);
  END LOOP;

  IF jsonb_array_length(v_insufficient) > 0 THEN
    success := false;
    order_id := NULL;
    error_text := jsonb_to_json(v_insufficient)::text;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Create order
  INSERT INTO orders (user_id, status, total, shipping_address, contact_info)
  VALUES (
    p_user_id,
    'pending',
    v_total,
    -- shipping address from p_checkout
    jsonb_build_object('houseNumber', p_checkout->>'houseNumber', 'street', p_checkout->>'street', 'city', p_checkout->>'city', 'zipCode', p_checkout->>'zipCode'),
    jsonb_build_object('fullName', p_checkout->>'fullName', 'email', p_checkout->>'email', 'phone', p_checkout->>'phone')
  )
  RETURNING id INTO v_order_id;

  -- Insert order items and decrement stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_beer_id := (v_item->>'beerId')::uuid;
    v_qty := (v_item->>'quantity')::int;
    v_price := (v_item->>'price')::numeric;

    INSERT INTO order_items (order_id, beer_id, quantity, price)
    VALUES (v_order_id, v_beer_id, v_qty, v_price);

    UPDATE beers SET stock = stock - v_qty WHERE id = v_beer_id;
  END LOOP;

  -- Create notification for admin
  INSERT INTO notifications (user_id, order_id, type, message, metadata)
  VALUES (
    p_user_id,
    v_order_id,
    'new_order',
    format('New order %s placed', v_order_id),
    jsonb_build_object(
      'shippingAddress', jsonb_build_object('houseNumber', p_checkout->>'houseNumber', 'street', p_checkout->>'street', 'city', p_checkout->>'city', 'zipCode', p_checkout->>'zipCode'),
      'contactInfo', jsonb_build_object('fullName', p_checkout->>'fullName','email', p_checkout->>'email','phone', p_checkout->>'phone'),
      'total', v_total,
      'itemCount', jsonb_array_length(p_items)
    )
  );

  success := true;
  order_id := v_order_id;
  error_text := NULL;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_transaction(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_transaction(uuid, jsonb, jsonb) TO service_role;

-- Helper to convert jsonb array to pretty text (simple)
CREATE OR REPLACE FUNCTION public.jsonb_to_json(p jsonb)
RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(p::text, '')::text;
$$;
