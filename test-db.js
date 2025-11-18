const { createClient } = require("@supabase/supabase-js");

const url = "https://nwzfnypcgkzfoulylcvc.supabase.co";
const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53emZueXBjZ2t6Zm91bHlsY3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MzI4MjYsImV4cCI6MjA3MjAwODgyNn0.mof9MAnJvHk-RGpqDb5lxqe8wVdJgCQ9dPXZR8b33JQ";

const supabase = createClient(url, key);

async function testConnection() {
  console.log("Testing database structure...");
  try {
    // Test beers table
    const { data: beers, error: beersError } = await supabase
      .from("beers")
      .select("*")
      .limit(3);
    if (beersError) {
      console.error("Error fetching beers:", beersError.message);
    } else {
      console.log("✅ Beers table - Found", beers.length, "beer(s)");
    }

    // Test products table (new unified table)
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .limit(5);
    if (productsError) {
      console.log(
        "❌ Products table not found or error:",
        productsError.message
      );
      console.log("🔧 You need to run the unified products table script");
    } else {
      console.log("✅ Products table - Found", products.length, "product(s)");
      if (products.length > 0) {
        console.log("Product categories:", [
          ...new Set(products.map((p) => p.category)),
        ]);
        console.log("Sample product:", JSON.stringify(products[0], null, 2));
      }
    }
  } catch (err) {
    console.error("Connection failed:", err.message);
  }
}

testConnection();
