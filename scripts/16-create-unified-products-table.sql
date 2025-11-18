-- Create unified products table to handle all product types
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL CHECK (category IN ('beer', 'milk', 'energy-drink', 'daily-product')),
  type TEXT NOT NULL, -- subcategory within each category
  price DECIMAL(10, 2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  image_url TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  
  -- Category-specific fields
  alcohol_content DECIMAL(4, 2), -- For alcoholic beverages (beer)
  volume INTEGER, -- For all beverages (ml)
  caffeine INTEGER, -- For energy drinks (mg)
  expiry_date DATE, -- For daily products
  
  -- Additional metadata
  barcode TEXT,
  supplier TEXT,
  cost_price DECIMAL(10, 2), -- For profit margin calculations
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_type ON public.products(type);
CREATE INDEX IF NOT EXISTS idx_products_is_premium ON public.products(is_premium);
CREATE INDEX IF NOT EXISTS idx_products_stock ON public.products(stock);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing beer data to products table
INSERT INTO public.products (
  id, name, brand, category, type, price, stock, description, image_url, is_premium,
  alcohol_content, volume, created_at, updated_at
)
SELECT 
  id,
  name,
  name, -- Use name as brand for now, can be updated later
  'beer' as category,
  lower(type) as type,
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
ON CONFLICT (id) DO NOTHING;

-- Insert sample non-beer products
INSERT INTO public.products (name, brand, category, type, price, stock, description, image_url, is_premium, volume, caffeine, expiry_date) VALUES
-- Energy Drinks
('Red Power Energy', 'PowerMax', 'energy-drink', 'original', 3.99, 100, 'High caffeine energy drink with taurine and B-vitamins', '/energy-red-power.jpg', false, 250, 160, '2025-06-15'),
('Blue Lightning Energy', 'PowerMax', 'energy-drink', 'sugar-free', 4.49, 85, 'Sugar-free energy drink with natural caffeine', '/energy-blue-lightning.jpg', false, 250, 180, '2025-07-20'),
('Monster Energy', 'Monster', 'energy-drink', 'original', 4.99, 60, 'Classic Monster energy drink', '/monster-energy.jpg', false, 355, 160, '2025-08-10'),
('Premium Energy Elite', 'EliteBoost', 'energy-drink', 'premium', 7.99, 30, 'Premium organic energy drink', '/premium-energy-elite.jpg', true, 250, 200, '2025-09-05'),

-- Milk & Dairy
('Fresh Whole Milk', 'DairyFresh', 'milk', 'whole', 4.99, 45, 'Fresh whole milk from local farms', '/fresh-whole-milk.jpg', false, 1000, null, '2024-11-25'),
('Low Fat Milk', 'HealthyChoice', 'milk', 'low-fat', 3.99, 50, '2% reduced fat milk', '/low-fat-milk.jpg', false, 1000, null, '2024-11-22'),
('Almond Milk', 'PlantBased', 'milk', 'plant-based', 5.49, 35, 'Unsweetened almond milk', '/almond-milk.jpg', false, 946, null, '2024-12-01'),
('Organic Oat Milk', 'Organic Valley', 'milk', 'plant-based', 6.99, 25, 'Creamy organic oat milk', '/organic-oat-milk.jpg', true, 946, null, '2024-11-28'),
('Chocolate Milk', 'SweetTreats', 'milk', 'flavored', 4.49, 40, 'Rich chocolate flavored milk', '/chocolate-milk.jpg', false, 500, null, '2024-11-20'),

-- Daily Products
('Artisan Sourdough Bread', 'BakeryFresh', 'daily-product', 'bakery', 6.99, 20, 'Fresh baked artisan sourdough bread', '/artisan-bread.jpg', true, null, null, '2024-11-16'),
('Organic Bananas', 'FreshFarms', 'daily-product', 'fruit', 2.99, 80, 'Organic bananas per bunch', '/organic-bananas.jpg', false, null, null, '2024-11-18'),
('Free Range Eggs', 'HappyFarms', 'daily-product', 'dairy', 5.99, 30, 'Free range chicken eggs (12 pack)', '/free-range-eggs.jpg', false, null, null, '2024-11-22'),
('Organic Yogurt', 'PureLife', 'daily-product', 'dairy', 4.99, 25, 'Organic Greek yogurt', '/organic-yogurt.jpg', true, 500, null, '2024-11-19'),
('Whole Wheat Pasta', 'ItalianStyle', 'daily-product', 'pantry', 3.49, 50, 'Whole wheat pasta 500g', '/wheat-pasta.jpg', false, null, null, '2025-03-15'),
('Premium Olive Oil', 'MediterraneanGold', 'daily-product', 'pantry', 12.99, 15, 'Extra virgin olive oil', '/premium-olive-oil.jpg', true, 500, null, '2025-12-30');