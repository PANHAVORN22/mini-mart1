# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

E-mart is a full-stack e-commerce platform built with Next.js 15 App Router, featuring a multi-category product system (beer, energy drinks, daily products), premium membership with rewards, and PayWay/ABA payment gateway integration for Cambodia.

## Development Commands

```bash
# Development
npm run dev          # Start dev server (default port 3000)

# Build & Production
npm run build        # Build for production
npm run start        # Run production server

# Code Quality
npm run lint         # Run ESLint (note: currently ignored during builds)
```

## Database Setup

Multiple setup scripts are available in the project root and `scripts/` directory:

```bash
# Option 1: Node.js setup with Supabase integration
node setup-database.js

# Option 2: Bash setup script
./setup-database.sh

# Option 3: Multi-category setup
./setup-multi-category.sh
```

The `scripts/` directory contains 24+ SQL migration files that should be run sequentially via Supabase SQL editor:
- `01-create-tables.sql` through `18-create-premium-events-table.sql`
- Each migration builds on previous ones

## Architecture

### Client/Server Separation (Next.js App Router)

**Server Components** (default):
- Pages in `app/*/page.tsx`
- Server actions in `lib/actions/`
- All database operations via Supabase

**Client Components** (marked with `"use client"`):
- Interactive UI components
- Zustand stores for client state
- Forms with React Hook Form

### Key Directories

```
app/                    # Next.js App Router pages & API routes
├── api/               # REST endpoints (admin, payments, rewards)
├── admin/             # Admin dashboard (protected)
├── catalog/           # Product listings
├── checkout/          # Order & payment flow
└── [other routes]/    # User-facing pages

components/            # React components
├── ui/               # Shadcn/ui primitives (56+ components)
└── [feature]/        # Feature-specific components

lib/
├── actions/          # Server actions (auth, admin, orders, etc.)
├── supabase/         # Supabase client/server instances
├── *-store.ts        # Zustand stores (cart, auth)
└── utils.ts          # Utilities

scripts/              # Database migration SQL files
```

### State Management

**Client State (Zustand + localStorage persistence)**:
- `lib/cart-store.ts`: Shopping cart with quantity management
- `lib/auth-store.ts`: User authentication state (legacy, partially used)

**Server State (Supabase)**:
- PostgreSQL database via Supabase
- Row Level Security (RLS) policies enabled
- Real-time subscriptions available but not heavily used

### Authentication & Authorization

**Supabase Auth** with role-based access:
- Two roles: `customer` and `admin`
- Admin registration requires code: `ADMIN2024`
- Server actions in `lib/actions/auth.ts`: `login()`, `signup()`, `logout()`, `getUser()`

**Middleware** (`middleware.ts`):
- Refreshes Supabase sessions on every request
- Logs unauthorized `/admin` access attempts
- Client-side pages handle actual access denial UX
- Skips all `/api/` routes

### Server Actions Pattern

All server actions follow this pattern:
```typescript
"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function actionName() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Perform action
  return { success: true, data }
}
```

Available in `lib/actions/`:
- `auth.ts`: Authentication operations
- `admin.ts`: Admin-only operations (product management)
- `beers.ts`: Product fetching (legacy name, handles all products)
- `orders.ts`: Order creation and transaction management
- `subscriptions.ts`: Premium subscription management

### API Routes

**Admin endpoints** (`app/api/admin/`):
- `beers/`, `products/`: Product CRUD
- `premium-members/`: Member management
- `rewards/`: Reward item management
- `stats/`: Analytics and dashboards

**Payment endpoints** (`app/api/payments/`):
- `aba/`: PayWay/ABA payment gateway integration
- `callback/`: Payment webhook handling

**Rewards endpoints** (`app/api/rewards/`):
- `items/`: Get available rewards
- `redeem/`: Redeem points for rewards
- `redemptions/`: View redemption history

### Database Schema

Core tables in Supabase PostgreSQL:
- `users`: User profiles linked to Supabase auth
- `beers`: Legacy beer products
- `products`: Unified multi-category products (beer, energy, daily)
- `orders`, `order_items`: Order management
- `subscriptions`: Premium memberships
- `premium_events`: Events for premium members
- `premium_rewards`: Reward items catalog
- `notifications`: User notifications
- `role_changes`: Audit log for role modifications

All tables have RLS policies enabled. Use Supabase SQL editor for schema changes.

### Payment Integration

**PayWay (ABA Bank)** for Cambodian market:
- Implementation in `app/api/payments/aba/route.ts`
- Supports shipping info and line items
- HMAC hash generation for security
- Webhook callback handling

### Component Library

56+ UI components from Shadcn/ui built on Radix UI primitives:
- All in `components/ui/`
- Styled with Tailwind CSS
- Full TypeScript support
- Import as needed: `import { Button } from "@/components/ui/button"`

### Path Aliases

TypeScript path alias configured in `tsconfig.json`:
```typescript
import { Component } from "@/components/Component"  // Resolves to root
```

The `@/*` alias points to the project root.

## Technology Stack

**Core Framework**:
- Next.js 15.2.4 with App Router
- React 19
- TypeScript 5

**Styling**:
- Tailwind CSS 4.1.9
- Shadcn/ui + Radix UI components
- Geist font from Vercel

**Backend & Data**:
- Supabase (PostgreSQL + Auth)
- pg 8.16.3 for direct DB access
- AWS S3 for file storage

**Forms & Validation**:
- React Hook Form 7.60.0
- Zod 3.25.76
- @hookform/resolvers

**State & Utils**:
- Zustand (client state)
- Immer (immutable updates)
- date-fns 4.1.0
- Recharts 2.15.4 (data visualization)

## Testing

**Status**: No testing framework configured
- No Jest, Vitest, or React Testing Library
- Manual testing is current approach
- Future improvement area

## Admin Features

Admin dashboard at `/admin` includes:
- SQL Editor: Direct database query execution
- Product Management: CRUD for all product categories
- Premium Member Management: View and manage subscriptions
- Rewards Management: Create and manage reward items
- Analytics Dashboard: Sales, orders, and user statistics

Access requires:
1. Authenticated user
2. `role = 'admin'` in users table
3. Middleware logs unauthorized attempts but allows client-side handling

## Payment Flow

1. User adds items to cart (Zustand store)
2. Checkout page collects shipping info
3. `POST /api/payments/aba` creates PayWay transaction
4. User redirects to PayWay gateway
5. PayWay webhook hits `/api/payments/callback`
6. Order status updated in database
7. User redirected to success/failure page

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# PayWay/ABA
PAYWAY_API_URL=
PAYWAY_MERCHANT_ID=
PAYWAY_API_KEY=

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=
```

## Important Notes

### Build Configuration
- **ESLint errors ignored** during builds (`next.config.mjs`)
- **TypeScript errors ignored** during builds
- **Image optimization disabled** (`unoptimized: true`)

These settings allow rapid iteration but should be addressed for production.

### Supabase Client Usage

**Server components/actions**:
```typescript
import { getSupabaseServerClient } from "@/lib/supabase/server"
const supabase = await getSupabaseServerClient()
```

**Client components**:
```typescript
import { createBrowserClient } from "@supabase/ssr"
const supabase = createBrowserClient(url, anonKey)
```

Never mix client and server Supabase instances.

### Middleware Considerations

Middleware runs on ALL non-static routes (except `/api/`). It:
- Refreshes Supabase sessions automatically
- Does NOT redirect unauthorized users (handled client-side)
- Logs admin access attempts for monitoring

Server actions must still perform their own authorization checks.

## Common Patterns

### Creating a new product category
1. Add category to `products` table enum (or create new table)
2. Update product creation forms in admin
3. Add filtering logic to catalog page
4. Update relevant server actions in `lib/actions/`

### Adding a new protected page
1. Create page in `app/[route]/page.tsx`
2. Check auth in server component or use client-side auth check
3. Middleware will handle session refresh automatically
4. Add explicit authorization in any server actions

### Working with forms
1. Use React Hook Form + Zod schema
2. Define schema in component or separate file
3. Use Shadcn/ui form components for consistent UX
4. Submit to server action or API route

## Deployment

Project is designed for Vercel deployment:
- Vercel Analytics already integrated
- Environment variables via Vercel dashboard
- Automatic deployments from git pushes
- Supabase handles database hosting
