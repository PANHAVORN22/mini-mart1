import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container py-8 md:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Jmom176</h3>
            <p className="text-sm text-muted-foreground">
              Your local craft beer destination. Quality beers, delivered fresh.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/catalog" className="text-muted-foreground hover:text-foreground transition-colors">
                  All Beers
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?type=ale"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Ales
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?type=lager"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Lagers
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?type=ipa"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  IPAs
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Account</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/orders" className="text-muted-foreground hover:text-foreground transition-colors">
                  Orders
                </Link>
              </li>
              <li>
                <Link href="/subscription" className="text-muted-foreground hover:text-foreground transition-colors">
                  Premium
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Support</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Jmom176. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
