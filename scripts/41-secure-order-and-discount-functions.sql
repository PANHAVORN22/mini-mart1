-- Harden server-side order and discount functions

-- 1) Recreate create_order_transaction to ignore client prices and derive user id
CREATE OR REPLACE FUNCTION public.create_order_transaction(
  p_user_id uuid,
  p_items jsonb,
  p_checkout jsonb
)
RETURNS TABLE(success boolean, order_id uuid, error_text text, computed_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
DECLARE
  v_total numeric := 0;
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_qty int;
  v_price numeric;
  v_stock int;
  v_product_name text;
  v_product_source text;
  v_category text;
  v_insufficient jsonb := '[]'::jsonb;
  v_product_sources jsonb := '{}'::jsonb;
  v_product_categories jsonb := '{}'::jsonb;
  v_user_id uuid := auth.uid();
BEGIN
  -- Always use the authenticated user id
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify stock and calculate total based on prices loaded from DB
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'beerId')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    v_price := NULL;
    v_product_name := NULL;
    v_product_source := NULL;
    v_category := NULL;

    IF v_product_id IS NULL THEN
      v_insufficient := v_insufficient || jsonb_build_object(
        'beerId', NULL,
        'name', 'Unknown product',
        'available', 0,
        'requested', v_qty
      );
      CONTINUE;
    END IF;

    SELECT stock, name, category, price
      INTO v_stock, v_product_name, v_category, v_price
      FROM products
      WHERE id = v_product_id
      FOR UPDATE;

    IF FOUND THEN
      v_product_source := 'products';
    ELSE
      SELECT stock, name, 'beer', price
        INTO v_stock, v_product_name, v_category, v_price
        FROM beers
        WHERE id = v_product_id
        FOR UPDATE;
      IF FOUND THEN
        v_product_source := 'beers';
      END IF;
    END IF;

    IF v_product_source IS NULL THEN
      v_insufficient := v_insufficient || jsonb_build_object(
        'beerId', v_product_id,
        'name', COALESCE(v_product_name, COALESCE(v_product_id::text, 'Unknown product')),
        'available', 0,
        'requested', v_qty
      );
    ELSE
      IF COALESCE(v_stock, 0) < v_qty THEN
        v_insufficient := v_insufficient || jsonb_build_object(
          'beerId', v_product_id,
          'name', COALESCE(v_product_name, v_product_id::text),
          'available', COALESCE(v_stock, 0),
          'requested', v_qty
        );
      END IF;

      v_product_sources := v_product_sources || jsonb_build_object(
        v_product_id::text,
        v_product_source
      );
      v_product_categories := v_product_categories || jsonb_build_object(
        v_product_id::text,
        COALESCE(v_category, 'beer')
      );
      v_total := v_total + (COALESCE(v_price, 0) * v_qty);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_insufficient) > 0 THEN
    success := false;
    order_id := NULL;
    error_text := (v_insufficient)::text;
    computed_total := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Create order with server-computed total
  INSERT INTO orders (user_id, status, total, shipping_address, contact_info)
  VALUES (
    v_user_id,
    'pending',
    v_total,
    jsonb_build_object(
      'houseNumber', p_checkout->>'houseNumber',
      'street', p_checkout->>'street',
      'city', p_checkout->>'city',
      'zipCode', p_checkout->>'zipCode'
    ),
    jsonb_build_object(
      'fullName', p_checkout->>'fullName',
      'email', p_checkout->>'email',
      'phone', p_checkout->>'phone'
    )
  )
  RETURNING id INTO v_order_id;

  -- Insert order items and decrement stock in the correct source table.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'beerId')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    v_product_source := v_product_sources->>v_product_id::text;
    v_category := v_product_categories->>v_product_id::text;

    -- Re-fetch authoritative price to record on item
    SELECT price INTO v_price FROM products WHERE id = v_product_id;
    IF NOT FOUND THEN
      SELECT price INTO v_price FROM beers WHERE id = v_product_id;
    END IF;

    INSERT INTO order_items (order_id, beer_id, quantity, price)
    VALUES (v_order_id, v_product_id, v_qty, COALESCE(v_price, 0));

    IF v_product_source = 'products' THEN
      UPDATE products SET stock = stock - v_qty WHERE id = v_product_id;
      IF v_category = 'beer' THEN
        UPDATE beers SET stock = stock - v_qty WHERE id = v_product_id;
      END IF;
    ELSIF v_product_source = 'beers' THEN
      UPDATE beers SET stock = stock - v_qty WHERE id = v_product_id;
    END IF;
  END LOOP;

  -- Notification
  INSERT INTO notifications (user_id, order_id, type, message, metadata)
  VALUES (
    v_user_id,
    v_order_id,
    'new_order',
    format('New order %s placed', v_order_id),
    jsonb_build_object(
      'shippingAddress', jsonb_build_object(
        'houseNumber', p_checkout->>'houseNumber',
        'street', p_checkout->>'street',
        'city', p_checkout->>'city',
        'zipCode', p_checkout->>'zipCode'
      ),
      'contactInfo', jsonb_build_object(
        'fullName', p_checkout->>'fullName',
        'email', p_checkout->>'email',
        'phone', p_checkout->>'phone'
      ),
      'total', v_total,
      'itemCount', jsonb_array_length(p_items)
    )
  );

  success := true;
  order_id := v_order_id;
  error_text := NULL;
  computed_total := v_total;
  RETURN NEXT;
END;
$body$;

GRANT EXECUTE ON FUNCTION public.create_order_transaction(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_transaction(uuid, jsonb, jsonb) TO service_role;

-- 2) Atomic usage increment for discounts
CREATE OR REPLACE FUNCTION public.secure_increment_discount_usage(p_discount_id uuid)
RETURNS discounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_row discounts;
BEGIN
  UPDATE discounts
  SET times_used = times_used + 1
  WHERE id = p_discount_id
    AND (usage_limit IS NULL OR times_used < usage_limit)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.secure_increment_discount_usage(uuid) TO service_role, authenticated;

