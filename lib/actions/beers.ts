"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function getBeers() {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase.from("beers").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching beers:", error)
    return []
  }

  return data.map((beer) => ({
    id: beer.id,
    name: beer.name,
    brand: beer.name.split(" ")[0], // Extract brand from name
    type: beer.type,
    description: beer.description || "",
    price: Number(beer.price),
    abv: Number(beer.alcohol_content) || 0,
    volume: beer.volume || 355,
    stock: beer.stock,
    imageUrl: beer.image_url || "/placeholder.svg",
    isPremiumOnly: beer.is_premium,
  }))
}

export async function getBeerById(id: string) {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase.from("beers").select("*").eq("id", id).single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    name: data.name,
    brand: data.name.split(" ")[0],
    type: data.type,
    description: data.description || "",
    price: Number(data.price),
    abv: Number(data.alcohol_content) || 0,
    volume: data.volume || 355,
    stock: data.stock,
    imageUrl: data.image_url || "/placeholder.svg",
    isPremiumOnly: data.is_premium,
  }
}

export async function getFeaturedBeers(limit = 4) {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("beers")
    .select("*")
    .limit(limit)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching featured products:", error)
    return []
  }

  return data.map((beer) => ({
    id: beer.id,
    name: beer.name,
    brand: beer.name.split(" ")[0],
    type: beer.type,
    description: beer.description || "",
    price: Number(beer.price),
    abv: Number(beer.alcohol_content) || 0,
    volume: beer.volume || 355,
    stock: beer.stock,
    imageUrl: beer.image_url || "/placeholder.svg",
    isPremiumOnly: beer.is_premium,
  }))
}
