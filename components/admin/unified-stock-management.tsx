"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Edit,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Package,
  Milk,
  Zap,
  Calendar,
  Wine,
} from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  type: string;
  price: number;
  stock: number;
  cost_price?: number;
  image_url: string;
  is_premium: boolean;
}

interface UnifiedStockManagementProps {
  initialProducts?: Product[];
  initialLegacyMode?: boolean;
  initialError?: string;
}

const PRODUCT_CATEGORIES = [
  { value: "beer", label: "Beer", icon: Wine },
  { value: "milk", label: "Milk & Dairy", icon: Milk },
  { value: "energy-drink", label: "Energy Drinks", icon: Zap },
  { value: "daily-product", label: "Daily Products", icon: Calendar },
];

export function UnifiedStockManagement({
  initialProducts = [],
  initialLegacyMode = false,
  initialError,
}: UnifiedStockManagementProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [filteredProducts, setFilteredProducts] =
    useState<Product[]>(initialProducts);
  const [isLoading, setIsLoading] = useState(initialProducts.length === 0);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newStock, setNewStock] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCostPrice, setNewCostPrice] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [legacyMode, setLegacyMode] = useState(initialLegacyMode);

  useEffect(() => {
    if (initialProducts.length === 0) {
      fetchProducts();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialError) {
      toast.error(initialError);
    }
  }, [initialError]);

  const filterProducts = useCallback(() => {
    let filtered = products;

    if (activeCategory !== "all") {
      filtered = filtered.filter((p) => p.category === activeCategory);
    }

    if (stockFilter === "low") {
      filtered = filtered.filter((p) => p.stock > 0 && p.stock < 20);
    } else if (stockFilter === "out") {
      filtered = filtered.filter((p) => p.stock === 0);
    } else if (stockFilter === "high") {
      filtered = filtered.filter((p) => p.stock >= 50);
    }

    setFilteredProducts(filtered);
  }, [activeCategory, products, stockFilter]);

  useEffect(() => {
    filterProducts();
  }, [filterProducts]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/products", {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to fetch products");
      }

      const payload = await response.json();
      setProducts(payload?.products || []);
      setLegacyMode(Boolean(payload?.legacyMode));
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch products"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setNewStock(product.stock.toString());
    setNewPrice(product.price.toString());
    setNewCostPrice(product.cost_price?.toString() || "");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingProduct) return;

    const stock = parseInt(newStock);
    const price = parseFloat(newPrice);
    const costPrice = newCostPrice ? parseFloat(newCostPrice) : null;

    if (isNaN(stock) || isNaN(price) || stock < 0 || price <= 0) {
      toast.error("Please enter valid values");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = getSupabaseBrowserClient();

      // Try to update products table first, fallback to beers table
      let { error } = await supabase
        .from("products")
        .update({
          stock,
          price,
          cost_price: costPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingProduct.id);

      if (error && error.message.includes("table")) {
        // Products table doesn't exist, update beers table
        console.log("Products table not found, updating beers table");

        const { error: beersError } = await supabase
          .from("beers")
          .update({
            stock,
            price,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingProduct.id);

        if (beersError) {
          console.error("Error updating beer:", beersError);
          toast.error("Failed to update product");
          return;
        }
      } else if (error) {
        console.error("Error updating product:", error);
        toast.error("Failed to update product");
        return;
      }

      toast.success("Product updated successfully!");
      fetchProducts();
      setIsDialogOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Failed to update product");
    } finally {
      setIsSaving(false);
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) {
      return {
        label: "Out of Stock",
        variant: "destructive" as const,
        icon: AlertTriangle,
      };
    } else if (stock < 10) {
      return {
        label: "Critical",
        variant: "destructive" as const,
        icon: TrendingDown,
      };
    } else if (stock < 20) {
      return {
        label: "Low Stock",
        variant: "secondary" as const,
        icon: TrendingDown,
      };
    } else if (stock >= 50) {
      return {
        label: "High Stock",
        variant: "default" as const,
        icon: TrendingUp,
      };
    } else {
      return { label: "Normal", variant: "default" as const, icon: Package };
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      beer: "bg-amber-100 text-amber-800",
      milk: "bg-blue-100 text-blue-800",
      "energy-drink": "bg-red-100 text-red-800",
      "daily-product": "bg-green-100 text-green-800",
    };
    return (
      colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800"
    );
  };

  const getStockSummary = () => {
    const total = filteredProducts.length;
    const outOfStock = filteredProducts.filter((p) => p.stock === 0).length;
    const lowStock = filteredProducts.filter(
      (p) => p.stock > 0 && p.stock < 20
    ).length;
    const totalValue = filteredProducts.reduce(
      (sum, p) => sum + p.price * p.stock,
      0
    );
    const totalCost = filteredProducts.reduce(
      (sum, p) => sum + (p.cost_price || 0) * p.stock,
      0
    );

    return { total, outOfStock, lowStock, totalValue, totalCost };
  };

  const summary = getStockSummary();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p>Loading stock data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {legacyMode && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Legacy mode (beers table)</p>
          <p>
            We detected that the unified <code>products</code> table is missing,
            so we are showing data from the old <code>beers</code> table. Create
            the new table using the provided SQL script to enable multi-category
            management.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Stock Management</h2>
          <p className="text-sm text-muted-foreground">
            Monitor and update inventory levels across all product categories
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock Levels</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
              <SelectItem value="low">Low Stock (&lt;20)</SelectItem>
              <SelectItem value="high">High Stock (≥50)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stock Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold">{summary.total}</div>
            </div>
            <p className="text-xs text-muted-foreground">Total Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <div className="text-2xl font-bold">{summary.outOfStock}</div>
            </div>
            <p className="text-xs text-muted-foreground">Out of Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              <div className="text-2xl font-bold">{summary.lowStock}</div>
            </div>
            <p className="text-xs text-muted-foreground">Low Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              ${summary.totalValue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Inventory Value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              ${(summary.totalValue - summary.totalCost).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Potential Profit</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList>
          <TabsTrigger value="all">All Categories</TabsTrigger>
          {PRODUCT_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const count = products.filter(
              (p) => p.category === category.value
            ).length;
            return (
              <TabsTrigger
                key={category.value}
                value={category.value}
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                {category.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stock Levels
                <Badge variant="secondary">
                  {filteredProducts.length} products
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock Value</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product.stock);
                    const StatusIcon = status.icon;
                    const stockValue = product.price * product.stock;

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 overflow-hidden rounded">
                              <Image
                                src={product.image_url || "/placeholder.svg"}
                                alt={product.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {product.brand}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(product.category)}>
                            {
                              PRODUCT_CATEGORIES.find(
                                (c) => c.value === product.category
                              )?.label
                            }
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {product.stock}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>${product.price.toFixed(2)}</TableCell>
                        <TableCell className="font-mono">
                          ${stockValue.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(product)}
                            className="gap-1"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {filteredProducts.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No products found matching the current filters.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Stock & Pricing</DialogTitle>
            <DialogDescription>
              Update stock levels and pricing for {editingProduct?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stock">Stock Quantity</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                placeholder="Enter stock quantity"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Selling Price ($)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Enter selling price"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_price">Cost Price ($) - Optional</Label>
              <Input
                id="cost_price"
                type="number"
                min="0"
                step="0.01"
                value={newCostPrice}
                onChange={(e) => setNewCostPrice(e.target.value)}
                placeholder="Enter cost price for profit tracking"
              />
            </div>

            {newCostPrice && newPrice && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium">Profit Analysis</p>
                <p className="text-sm text-muted-foreground">
                  Margin: $
                  {(parseFloat(newPrice) - parseFloat(newCostPrice)).toFixed(2)}{" "}
                  per unit (
                  {(
                    ((parseFloat(newPrice) - parseFloat(newCostPrice)) /
                      parseFloat(newPrice)) *
                    100
                  ).toFixed(1)}
                  %)
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
