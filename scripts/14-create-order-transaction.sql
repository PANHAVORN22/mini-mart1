
-- SQL migration to create a transaction-safe order creation function
-- Updated to work with the unified products table so orders for milk,
-- energy drinks, and daily products no longer fail stock checks.

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
BEGIN
  -- Ensure the caller is creating an order for themselves. This prevents
  -- admins or malicious clients from spoofing user ids when the function runs
  -- with elevated privileges.
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Caller does not match authenticated user';
  END IF;

  -- Calculate total and verify stock across the unified products catalog.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'beerId')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    v_price := (v_item->>'price')::numeric;

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

    SELECT stock, name, category
      INTO v_stock, v_product_name, v_category
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

    IF FOUND THEN
      v_product_source := 'products';
    ELSE
      SELECT stock, name, 'beer'
        INTO v_stock, v_product_name, v_category
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
    v_price := (v_item->>'price')::numeric;
    v_product_source := v_product_sources->>v_product_id::text;
    v_category := v_product_categories->>v_product_id::text;

    INSERT INTO order_items (order_id, beer_id, quantity, price)
    VALUES (v_order_id, v_product_id, v_qty, v_price);

    IF v_product_source = 'products' THEN
      UPDATE products
      SET stock = stock - v_qty
      WHERE id = v_product_id;

      IF v_category = 'beer' THEN
        UPDATE beers
        SET stock = stock - v_qty
        WHERE id = v_product_id;
      END IF;
    ELSIF v_product_source = 'beers' THEN
      UPDATE beers
      SET stock = stock - v_qty
      WHERE id = v_product_id;
    END IF;
  END LOOP;

  -- Create notification for admin
  INSERT INTO notifications (user_id, order_id, type, message, metadata)
  VALUES (
    p_user_id,
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
