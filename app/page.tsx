import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Star, Truck, Shield, Crown } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { getFeaturedBeers } from "@/lib/actions/beers";

export default async function HomePage() {
  const featuredBeers = await getFeaturedBeers(4);

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-background py-20 md:py-32">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="mb-4" variant="secondary">
                Premium Craft Products Selection
              </Badge>
              <h1 className="mb-6 text-4xl font-bold tracking-tight text-balance md:text-6xl">
                Discover Your Perfect Products
              </h1>
              <p className="mb-8 text-lg text-muted-foreground text-pretty md:text-xl">
                Explore our curated collection of craft products from local and
                international breweries. Quality, freshness, and variety
                delivered to your door.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                <Link href="/catalog">
                  <Button size="lg" className="w-full sm:w-auto">
                    Browse Catalog
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/subscription">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto bg-transparent"
                  >
                    <Crown className="mr-2 h-4 w-4" />
                    Go Premium
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 md:py-24">
          <div className="container">
            <div className="grid gap-8 md:grid-cols-3">
              <Card>
                <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Star className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Premium Selection</h3>
                  <p className="text-sm text-muted-foreground">
                    Handpicked craft beers from award-winning breweries around
                    the world
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Truck className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Fast Delivery</h3>
                  <p className="text-sm text-muted-foreground">
                    Quick and reliable delivery to ensure your beer arrives
                    fresh and cold
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Quality Guaranteed</h3>
                  <p className="text-sm text-muted-foreground">
                    Every beer is carefully stored and handled to maintain
                    perfect quality
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Featured products Section */}
        <section className="bg-muted/50 py-16 md:py-24">
          <div className="container">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Featured Products
              </h2>
              <p className="text-muted-foreground">
                Discover our most popular craft beers
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featuredBeers.map((beer) => (
                <Card key={beer.id} className="overflow-hidden">
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img
                      src={beer.imageUrl || "/placeholder.svg"}
                      alt={beer.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-balance">
                          {beer.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {beer.brand}
                        </p>
                      </div>
                      {beer.isPremiumOnly && (
                        <Badge variant="secondary" className="shrink-0">
                          <Crown className="mr-1 h-3 w-3" />
                          Premium
                        </Badge>
                      )}
                    </div>
                    <div className="mb-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{beer.type}</span>
                      <span className="font-medium">{beer.abv}% ABV</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">
                        ${beer.price.toFixed(2)}
                      </span>
                      <Link href={`/catalog?id=${beer.id}`}>
                        <Button size="sm">View Details</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Link href="/catalog">
                <Button size="lg" variant="outline">
                  View All Beers
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-24">
          <div className="container">
            <Card className="overflow-hidden bg-primary text-primary-foreground">
              <CardContent className="p-8 md:p-12">
                <div className="mx-auto max-w-2xl text-center">
                  <Crown className="mx-auto mb-4 h-12 w-12" />
                  <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                    Unlock Premium Access
                  </h2>
                  <p className="mb-8 text-lg opacity-90">
                    Get exclusive access to rare beers, special discounts, and
                    priority delivery with our premium membership
                  </p>
                  <Link href="/subscription">
                    <Button size="lg" variant="secondary">
                      Learn More About Premium
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
