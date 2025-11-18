#!/bin/bash

# E-mart Multi-Category Database Setup Script
echo "🛒 E-mart Multi-Category Database Quick Setup"
echo "============================================="

# Copy SQL to clipboard
echo "📋 Copying SQL to clipboard..."
pbcopy < scripts/17-create-products-table.sql
echo "✅ SQL copied to clipboard!"

echo ""
echo "🚀 Quick Setup Steps:"
echo "1. Opening Supabase Dashboard..."
echo "2. Paste the SQL (Cmd+V) in the SQL Editor"
echo "3. Click 'Run' to execute"
echo ""

# Open Supabase SQL Editor
open "https://supabase.com/dashboard/project/nwzfnypcgkzfoulylcvc/sql/new"

echo "⏳ Waiting for you to run the SQL..."
echo "Press any key after running the SQL to verify setup..."
read -n 1 -s

# Verify setup
echo ""
echo "🔍 Verifying setup..."
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://nwzfnypcgkzfoulylcvc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53emZueXBjZ2t6Zm91bHlsY3ZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQzMjgyNiwiZXhwIjoyMDcyMDA4ODI2fQ.RMWcmfRkBBdJyUvPzhFBeaYY5NYDZptLBXZNRfznR_g');

(async () => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('category');
    
    if (error) {
      console.log('❌ Setup not complete yet. Please run the SQL in Supabase.');
      return;
    }
    
    const categoryCount = products.reduce((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {});
    
    console.log('✅ Setup completed successfully!');
    console.log('📊 Product Summary:');
    Object.entries(categoryCount).forEach(([category, count]) => {
      console.log(\`   \${category}: \${count} products\`);
    });
    console.log(\`   Total: \${products.length} products\`);
    console.log('');
    console.log('🎉 Your E-mart now supports multiple product categories!');
    console.log('   • Go to /admin to manage products');
    console.log('   • Visit /catalog to see all categories');
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
})();
"

echo ""
echo "🎯 Next steps:"
echo "   • npm run dev (start your app)"
echo "   • Go to localhost:3000/admin to add products"
echo "   • Visit localhost:3000/catalog to see all categories"