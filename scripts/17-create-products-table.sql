-- Create unified products table for multi-category support
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL CHECK (category IN ('beer', 'milk', 'energy-drink', 'daily-product')),
  type TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  image_url TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  alcohol_content DECIMAL(4, 2),
  volume INTEGER,
  caffeine INTEGER,
  expiry_date DATE,
  barcode TEXT,
  supplier TEXT,
  cost_price DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_type ON public.products(type);
CREATE INDEX IF NOT EXISTS idx_products_is_premium ON public.products(is_premium);
CREATE INDEX IF NOT EXISTS idx_products_stock ON public.products(stock);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view products" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "Admin users can insert products" ON public.products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update products" ON public.products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete products" ON public.products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Migrate existing beer data to products table
INSERT INTO public.products (
  id, name, brand, category, type, price, stock, description, 
  image_url, is_premium, alcohol_content, volume, created_at, updated_at
)
SELECT 
  id,
  name,
  split_part(name, ' ', 1) as brand, -- Extract brand from name
  'beer' as category,
  LOWER(type) as type,
  price,
  stock,
  description,
  image_url,
  is_premium,
  alcohol_content,
  volume,
  created_at,
  updated_at
FROM public.beers
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  is_premium = EXCLUDED.is_premium,
  alcohol_content = EXCLUDED.alcohol_content,
  volume = EXCLUDED.volume,
  updated_at = NOW();

-- Insert sample products for other categories
INSERT INTO public.products (name, brand, category, type, price, stock, description, image_url, is_premium, volume, caffeine, expiry_date) VALUES
-- Energy Drinks
('Red Power Energy', 'PowerMax', 'energy-drink', 'original', 3.99, 100, 'High caffeine energy drink with taurine and B-vitamins', '/energy-red-power.jpg', false, 250, 160, '2025-06-15'),
('Blue Lightning Energy', 'PowerMax', 'energy-drink', 'sugar-free', 4.49, 85, 'Sugar-free energy drink with natural caffeine', '/energy-blue-lightning.jpg', false, 250, 180, '2025-07-20'),
('Monster Ultra', 'Monster', 'energy-drink', 'zero', 4.99, 60, 'Zero sugar monster energy drink', '/monster-ultra.jpg', false, 473, 140, '2025-05-10'),

-- Milk & Dairy
('Fresh Whole Milk', 'DairyFresh', 'milk', 'whole', 4.99, 45, 'Fresh whole milk from local farms', '/fresh-whole-milk.jpg', false, 1000, null, '2024-11-25'),
('Organic Oat Milk', 'Organic Valley', 'milk', 'plant-based', 6.99, 25, 'Creamy organic oat milk', '/organic-oat-milk.jpg', true, 946, null, '2024-11-28'),
('Almond Milk Unsweetened', 'Blue Diamond', 'milk', 'plant-based', 5.49, 35, 'Unsweetened almond milk', '/almond-milk.jpg', false, 946, null, '2024-12-05'),
('Greek Yogurt', 'Chobani', 'milk', 'yogurt', 7.99, 20, 'Thick and creamy Greek yogurt', '/greek-yogurt.jpg', true, 907, null, '2024-11-20'),

-- Daily Products  
('Artisan Sourdough Bread', 'BakeryFresh', 'daily-product', 'bakery', 6.99, 20, 'Fresh baked artisan sourdough bread', '/artisan-bread.jpg', true, null, null, '2024-11-16'),
('Organic Bananas', 'FreshFarms', 'daily-product', 'fruit', 2.99, 80, 'Organic bananas per bunch', '/organic-bananas.jpg', false, null, null, '2024-11-18'),
('Free Range Eggs', 'FarmFresh', 'daily-product', 'dairy', 8.99, 30, 'Free range chicken eggs - dozen', '/free-range-eggs.jpg', true, null, null, '2024-11-22'),
('Avocado', 'FreshFarms', 'daily-product', 'fruit', 3.99, 50, 'Fresh ripe avocados - pack of 2', '/avocado.jpg', false, null, null, '2024-11-17'),
('Whole Wheat Pasta', 'Barilla', 'daily-product', 'pantry', 4.49, 40, 'Whole wheat penne pasta', '/whole-wheat-pasta.jpg', false, null, null, '2025-12-01'),
('Extra Virgin Olive Oil', 'Bertolli', 'daily-product', 'pantry', 12.99, 15, 'Premium extra virgin olive oil', '/olive-oil.jpg', true, 500, null, '2026-03-15');