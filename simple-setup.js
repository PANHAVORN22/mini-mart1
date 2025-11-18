const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://nwzfnypcgkzfoulylcvc.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53emZueXBjZ2t6Zm91bHlsY3ZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQzMjgyNiwiZXhwIjoyMDcyMDA4ODI2fQ.RMWcmfRkBBdJyUvPzhFBeaYY5NYDZptLBXZNRfznR_g";

const supabase = createClient(supabaseUrl, serviceKey);

async function createTable() {
  console.log('🛒 Creating products table...');
  
  try {
    // Create table using SQL
    const { error } = await supabase.sql`
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
    `;

    if (error) {
      console.error('❌ Error creating table:', error);
      return false;
    }

    console.log('✅ Products table created');
    return true;
  } catch (error) {
    console.error('❌ SQL not supported, using step-by-step approach');
    return false;
  }
}

async function migrateData() {
  console.log('📦 Migrating beer data...');
  
  try {
    // Get all beers
    const { data: beers, error: beersError } = await supabase
      .from('beers')
      .select('*');

    if (beersError) {
      console.error('❌ Error fetching beers:', beersError);
      return false;
    }

    if (!beers || beers.length === 0) {
      console.log('⚠️ No beer data to migrate');
      return true;
    }

    // Transform beer data to products format
    const productData = beers.map(beer => ({
      id: beer.id,
      name: beer.name,
      brand: beer.name.split(' ')[0],
      category: 'beer',
      type: beer.type.toLowerCase(),
      price: beer.price,
      stock: beer.stock,
      description: beer.description,
      image_url: beer.image_url,
      is_premium: beer.is_premium,
      alcohol_content: beer.alcohol_content,
      volume: beer.volume,
      created_at: beer.created_at,
      updated_at: beer.updated_at
    }));

    // Insert products
    const { error: insertError } = await supabase
      .from('products')
      .upsert(productData, { onConflict: 'id' });

    if (insertError) {
      console.error('❌ Error migrating beers:', insertError);
      return false;
    }

    console.log(`✅ Migrated ${beers.length} beer products`);
    return true;
  } catch (error) {
    console.error('❌ Error in migration:', error);
    return false;
  }
}

async function addSamples() {
  console.log('🛒 Adding sample products...');
  
  const samples = [
    // Energy Drinks
    {
      name: 'Red Power Energy',
      brand: 'PowerMax',
      category: 'energy-drink',
      type: 'original',
      price: 3.99,
      stock: 100,
      description: 'High caffeine energy drink',
      volume: 250,
      caffeine: 160,
      expiry_date: '2025-06-15'
    },
    {
      name: 'Blue Lightning Energy',
      brand: 'PowerMax',
      category: 'energy-drink',
      type: 'sugar-free',
      price: 4.49,
      stock: 85,
      description: 'Sugar-free energy drink',
      volume: 250,
      caffeine: 180,
      expiry_date: '2025-07-20'
    },
    // Milk
    {
      name: 'Fresh Whole Milk',
      brand: 'DairyFresh',
      category: 'milk',
      type: 'whole',
      price: 4.99,
      stock: 45,
      description: 'Fresh whole milk from local farms',
      volume: 1000,
      expiry_date: '2024-11-25'
    },
    {
      name: 'Organic Oat Milk',
      brand: 'Organic Valley',
      category: 'milk',
      type: 'plant-based',
      price: 6.99,
      stock: 25,
      description: 'Creamy organic oat milk',
      is_premium: true,
      volume: 946,
      expiry_date: '2024-11-28'
    },
    // Daily Products
    {
      name: 'Artisan Sourdough Bread',
      brand: 'BakeryFresh',
      category: 'daily-product',
      type: 'bakery',
      price: 6.99,
      stock: 20,
      description: 'Fresh baked artisan sourdough bread',
      is_premium: true,
      expiry_date: '2024-11-16'
    },
    {
      name: 'Organic Bananas',
      brand: 'FreshFarms',
      category: 'daily-product',
      type: 'fruit',
      price: 2.99,
      stock: 80,
      description: 'Organic bananas per bunch',
      expiry_date: '2024-11-18'
    }
  ];

  try {
    const { error } = await supabase
      .from('products')
      .insert(samples);

    if (error) {
      console.error('❌ Error adding samples:', error);
      return false;
    }

    console.log(`✅ Added ${samples.length} sample products`);
    return true;
  } catch (error) {
    console.error('❌ Error in adding samples:', error);
    return false;
  }
}

async function main() {
  console.log('🛒 E-mart Database Setup');
  console.log('========================');
  
  // Check if table exists
  const { error: checkError } = await supabase
    .from('products')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('✅ Products table already exists');
  } else {
    console.log('📋 Creating products table manually...');
    console.log('\n🔧 Run this SQL in Supabase SQL Editor:');
    console.log(`
CREATE TABLE public.products (
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

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admin users can modify products" ON public.products FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);
    `);
    console.log('\n⏸️ Run the script again after creating the table');
    return;
  }

  // Migrate and add data
  await migrateData();
  await addSamples();

  // Verify
  const { data: products } = await supabase
    .from('products')
    .select('category');

  const categoryCount = products.reduce((acc, product) => {
    acc[product.category] = (acc[product.category] || 0) + 1;
    return acc;
  }, {});

  console.log('\n✅ Setup complete!');
  console.log('📊 Products by category:');
  Object.entries(categoryCount).forEach(([category, count]) => {
    console.log(`   ${category}: ${count} products`);
  });
  
  console.log('\n🎉 Your E-mart now supports multiple categories!');
}

main();