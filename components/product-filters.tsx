"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Beer, Zap, Calendar, Milk } from "lucide-react";

interface ProductFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  productTypes: string[];
  priceRange: [number, number];
  onPriceRangeChange: (value: [number, number]) => void;
  showPremiumOnly: boolean;
  onPremiumOnlyChange: (value: boolean) => void;
}

export function ProductFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedType,
  onTypeChange,
  productTypes,
  priceRange,
  onPriceRangeChange,
  showPremiumOnly,
  onPremiumOnlyChange,
}: ProductFiltersProps) {
  const categories = [
    { value: "all", label: "All Products", icon: null },
    { value: "beer", label: "Beer", icon: Beer },
    { value: "energy-drink", label: "Energy Drinks", icon: Zap },
    { value: "milk", label: "Milk & Dairy", icon: Milk },
    { value: "daily-product", label: "Daily Products", icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={selectedCategory} onValueChange={onCategoryChange}>
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <div
                  key={category.value}
                  className="flex items-center space-x-2"
                >
                  <RadioGroupItem value={category.value} id={category.value} />
                  <Label
                    htmlFor={category.value}
                    className="cursor-pointer flex items-center gap-2"
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {category.label}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Type</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedType} onValueChange={onTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {productTypes.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price Range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Slider
            min={0}
            max={50}
            step={1}
            value={priceRange}
            onValueChange={(value) =>
              onPriceRangeChange(value as [number, number])
            }
          />
          <div className="flex items-center justify-between text-sm">
            <span>${priceRange[0]}</span>
            <span>${priceRange[1]}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="premium"
              checked={showPremiumOnly}
              onCheckedChange={onPremiumOnlyChange}
            />
            <Label htmlFor="premium" className="cursor-pointer text-sm">
              Premium products only
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
