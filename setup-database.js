const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin operations
const url = 'https://nwzfnypcgkzfoulylcvc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53emZueXBjZ2t6Zm91bHlsY3ZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQzMjgyNiwiZXhwIjoyMDcyMDA4ODI2fQ.RMWcmfRkBBdJyUvPzhFBeaYY5NYDZptLBXZNRfznR_g';

const supabase = createClient(url, serviceKey);

async function createProductsTable() {
  console.log('🚀 Creating unified products table...');
  
  try {
    // Check if products table already exists
    const { data: tables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'products');

    if (checkError) {
      console.log('Note: Could not check existing tables, proceeding with creation');
    } else if (tables && tables.length > 0) {
      console.log('✅ Products table already exists');
      return true;
    }

    // Since we can't execute DDL directly, let's create the table through a different approach
    // We'll try to query the products table first
    const { error: queryError } = await supabase
      .from('products')
      .select('id')
      .limit(1);

    if (!queryError) {
      console.log('✅ Products table already exists and is accessible');
      return true;
    }

    console.log('📋 Products table needs to be created manually in Supabase');
    console.log('Please run this SQL in your Supabase SQL Editor:');
    console.log(`
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
    `);
    
    return false; // Table needs manual creation
  } catch (error) {
    console.error('❌ Error in table creation check:', error);
    return false;
  }
}

async function migrateExistingData() {
  console.log('📦 Migrating existing beer data...');
  
  try {
    // Get existing beers
    const { data: beers, error: beersError } = await supabase
      .from('beers')
      .select('*');

    if (beersError) {
      console.error('❌ Error fetching beers:', beersError);
      return false;
    }

    if (!beers || beers.length === 0) {
      console.log('⚠️ No existing beer data found to migrate');
      return true;
    }

    // Transform and insert beer data into products table
    const productData = beers.map(beer => ({
      id: beer.id,
      name: beer.name,
      brand: beer.name.split(' ')[0], // Extract brand from name
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

    const { error: insertError } = await supabase
      .from('products')
      .upsert(productData, { onConflict: 'id' });

    if (insertError) {
      console.error('❌ Error migrating beer data:', insertError);
      return false;
    }

    console.log(`✅ Successfully migrated ${beers.length} beer products`);
    return true;
  } catch (error) {
    console.error('❌ Error in data migration:', error);
    return false;
  }
}

async function addSampleProducts() {
  console.log('🛒 Adding sample products for other categories...');
  
  try {
    const sampleProducts = [
      // Energy Drinks
      {
        name: 'Red Power Energy',
        brand: 'PowerMax',
        category: 'energy-drink',
        type: 'original',
        price: 3.99,
        stock: 100,
        description: 'High caffeine energy drink with taurine and B-vitamins',
        image_url: '/energy-red-power.jpg',
        is_premium: false,
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
        description: 'Sugar-free energy drink with natural caffeine',
        image_url: '/energy-blue-lightning.jpg',
        is_premium: false,
        volume: 250,
        caffeine: 180,
        expiry_date: '2025-07-20'
      },
      // Milk & Dairy
      {
        name: 'Fresh Whole Milk',
        brand: 'DairyFresh',
        category: 'milk',
        type: 'whole',
        price: 4.99,
        stock: 45,
        description: 'Fresh whole milk from local farms',
        image_url: '/fresh-whole-milk.jpg',
        is_premium: false,
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
        image_url: '/organic-oat-milk.jpg',
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
        image_url: '/artisan-bread.jpg',
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
        image_url: '/organic-bananas.jpg',
        is_premium: false,
        expiry_date: '2024-11-18'
      }
    ];

    const { error: insertError } = await supabase
      .from('products')
      .insert(sampleProducts);

    if (insertError) {
      console.error('❌ Error adding sample products:', insertError);
      return false;
    }

    console.log(`✅ Successfully added ${sampleProducts.length} sample products`);
    return true;
  } catch (error) {
    console.error('❌ Error adding sample products:', error);
    return false;
  }
}

async function setupDatabase() {
  console.log('🛒 E-mart Multi-Category Database Setup');
  console.log('=====================================');
  
  try {
    // Step 1: Check/create products table
    const tableReady = await createProductsTable();
    
    if (!tableReady) {
      console.log('\n⏸️  Setup paused - please create the products table first');
      console.log('After running the SQL above, run this script again to continue...');
      return;
    }

    // Step 2: Migrate existing beer data
    const dataMigrated = await migrateExistingData();
    if (!dataMigrated) {
      console.log('❌ Setup failed at data migration');
      return;
    }

    // Step 3: Add sample products
    const samplesAdded = await addSampleProducts();
    if (!samplesAdded) {
      console.log('❌ Setup failed at adding samples');
      return;
    }

    // Step 4: Verify setup
    console.log('\n🔍 Verifying setup...');
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('category, id')
      .order('category');

    if (error) {
      console.error('❌ Error verifying setup:', error);
      return;
    }

    console.log('\n✅ Setup completed successfully!');
    console.log('\n📊 Product Summary:');
    if (allProducts && allProducts.length > 0) {
      const categoryCount = allProducts.reduce((acc, product) => {
        acc[product.category] = (acc[product.category] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(categoryCount).forEach(([category, count]) => {
        console.log(`   ${category}: ${count} products`);
      });
      console.log(`   Total: ${allProducts.length} products`);
    }
    
    console.log('\n🎉 Your E-mart now supports multiple product categories!');
    console.log('   • Go to /admin to add products in different categories');
    console.log('   • Visit /catalog to see all product types');
    console.log('   • Use the stock management to track inventory across categories');

  } catch (error) {
    console.error('❌ Unexpected error during setup:', error);
  }
}

setupDatabase();