#!/bin/bash

# E-mart Database Setup Script
# This script creates the unified products table and populates it with data

echo "🚀 Setting up unified products table..."
echo "📋 Please run the following SQL script in your Supabase SQL editor:"
echo ""
echo "================================="
cat scripts/16-create-unified-products-table.sql
echo "================================="
echo ""
echo "📝 Instructions:"
echo "1. Copy the SQL above"
echo "2. Go to your Supabase dashboard"
echo "3. Navigate to SQL Editor"
echo "4. Paste and run the SQL"
echo "5. Run 'node test-db.js' again to verify setup"
echo ""
echo "🌐 Supabase Dashboard: https://supabase.com/dashboard"