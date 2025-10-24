"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Edit, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { updateBeerStock } from "@/lib/actions/admin"

interface Beer {
  id: string
  name: string
  brand: string
  type: string
  price: number
  stock: number
}

export function StockManagement() {
  const [beers, setBeers] = useState<Beer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingBeer, setEditingBeer] = useState<Beer | null>(null)
  const [newStock, setNewStock] = useState("")
  const [newPrice, setNewPrice] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState(0)
  const saveTimerRef = useRef<number | null>(null)

  // Clear any running timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearInterval(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const fetchBeers = async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.from("beers").select("*").order("name")

      if (error) {
        console.error("Error fetching beers:", error)
        setIsLoading(false)
        return
      }

      const formattedBeers = data.map((beer: any) => ({
        id: beer.id,
        name: beer.name,
        brand: beer.name.split(" ")[0],
        type: beer.type,
        price: Number(beer.price),
        stock: beer.stock,
      }))

      setBeers(formattedBeers)
      setIsLoading(false)
    }

    fetchBeers()
  }, [])

  const handleEdit = (beer: Beer) => {
    setEditingBeer(beer)
    setNewStock(beer.stock.toString())
    setNewPrice(beer.price.toString())
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editingBeer) return

    setIsSaving(true)
    // start progress indicator (will be completed when server action returns)
    setSaveProgress(0)
    if (saveTimerRef.current) window.clearInterval(saveTimerRef.current)
    saveTimerRef.current = window.setInterval(() => {
      setSaveProgress((p) => Math.min(90, p + Math.floor(Math.random() * 8) + 1))
    }, 300)

    const result = await updateBeerStock(editingBeer.id, Number.parseInt(newStock), Number.parseFloat(newPrice))

    if (result.success) {
      // Update local state
      const updatedBeers = beers.map((beer) =>
        beer.id === editingBeer.id
          ? {
              ...beer,
              stock: Number.parseInt(newStock),
              price: Number.parseFloat(newPrice),
            }
          : beer,
      )

      setBeers(updatedBeers)
      setIsDialogOpen(false)
      toast.success("Stock updated", {
        description: `${editingBeer.name} has been updated successfully`,
      })
    } else {
      toast.error("Failed to update stock", {
        description: result.error,
      })
    }

    // finish progress and clear timer
    setSaveProgress(100)
    if (saveTimerRef.current) {
      window.clearInterval(saveTimerRef.current)
      saveTimerRef.current = null
    }

    setTimeout(() => setSaveProgress(0), 500)
    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading inventory...</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Beer Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Beer</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beers.map((beer) => (
                <TableRow key={beer.id}>
                  <TableCell className="font-medium">{beer.name}</TableCell>
                  <TableCell>{beer.brand}</TableCell>
                  <TableCell>{beer.type}</TableCell>
                  <TableCell>${beer.price.toFixed(2)}</TableCell>
                  <TableCell>{beer.stock}</TableCell>
                  <TableCell>
                    {beer.stock === 0 ? (
                      <Badge variant="destructive">Out of Stock</Badge>
                    ) : beer.stock < 20 ? (
                      <Badge variant="secondary" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Low Stock
                      </Badge>
                    ) : (
                      <Badge variant="default">In Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" onClick={() => handleEdit(beer)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="relative max-w-2xl mx-auto bg-white text-black dark:bg-black dark:text-white">
              {isSaving && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-black/80 p-4">
                  <div className="flex items-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    <div className="w-full max-w-md">
                      <Progress value={saveProgress} indicatorClassName="bg-black dark:bg-white" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{`Saving... ${saveProgress}%`}</p>
                </div>
              )}
            <DialogHeader>
              <DialogTitle>Edit Stock</DialogTitle>
              <DialogDescription>Update the stock and price for {editingBeer?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock Quantity</Label>
                <Input
                  id="stock"
                  type="number"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
