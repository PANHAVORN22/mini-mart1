const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const supabaseUrl = "https://nwzfnypcgkzfoulylcvc.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53emZueXBjZ2t6Zm91bHlsY3ZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQzMjgyNiwiZXhwIjoyMDcyMDA4ODI2fQ.RMWcmfRkBBdJyUvPzhFBeaYY5NYDZptLBXZNRfznR_g";

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSQL() {
  try {
    console.log('🛒 E-mart Multi-Category Database Setup');
    console.log('=====================================');
    console.log('🔌 Connecting to Supabase...');
    
    // Test connection
    const { data: testData, error: testError } = await supabase
      .from('beers')
      .select('id')
      .limit(1);
    
    if (testError) {
      throw new Error(`Connection failed: ${testError.message}`);
    }
    
    console.log('✅ Connected successfully');

    // Check if products table already exists
    console.log('📋 Checking if products table exists...');
    const { error: existsError } = await supabase
      .from('products')
      .select('id')
      .limit(1);

    if (!existsError) {
      console.log('✅ Products table already exists');
      
      // Verify the setup
      console.log('🔍 Verifying current setup...');
      const { data: products, error: countError } = await supabase
        .from('products')
        .select('category');
      
      if (countError) {
        console.error('❌ Error counting products:', countError.message);
        return;
      }
      
      const categoryCount = products.reduce((acc, product) => {
        acc[product.category] = (acc[product.category] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\n📊 Current Product Summary:');
      let totalProducts = 0;
      
      Object.entries(categoryCount).forEach(([category, count]) => {
        console.log(`   ${category}: ${count} products`);
        totalProducts += count;
      });
      
      console.log(`   Total: ${totalProducts} products`);
      console.log('\n✅ Database is ready for multi-category support!');
      return;
    }

    console.log('📄 Products table doesn\'t exist. Creating via manual steps...');
    
    // Read the SQL file to show user what to execute
    const sqlFile = path.join(__dirname, 'scripts', '17-create-products-table.sql');
    
    if (!fs.existsSync(sqlFile)) {
      console.error('❌ SQL file not found:', sqlFile);
      return;
    }
    
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('\n🔧 Please copy and paste this SQL in your Supabase SQL Editor:');
    console.log('=' .repeat(60));
    console.log(sql);
    console.log('=' .repeat(60));
    
    console.log('\n📋 After running the SQL:');
    console.log('1. Go to your Supabase Dashboard → SQL Editor');
    console.log('2. Copy and paste the SQL above');
    console.log('3. Click "Run" to execute');
    console.log('4. Run this script again to verify setup');
    
    console.log('\n💡 Alternatively, run: node setup-database-direct.js');

  } catch (error) {
    console.error('❌ Error during setup:', error.message);
  }
}

executeSQL();