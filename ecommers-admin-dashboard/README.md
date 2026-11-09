# Meridion Admin Dashboard

Meridion Admin is an independently deployable React + TypeScript + Vite dashboard for the Meridion Marketplace. It uses the same shared Supabase project as the storefront (`paperloom-store`, ref `xrrhbnnzjqkqnqdvayjw`) and never creates a second backend or database.

Every screen reads live Supabase data. Empty tables are shown as empty; the dashboard does not create sample products, orders, customers or revenue.

## Project structure

```text
ecommers-admin-dashboard/
├── public/images/              # Brand/static image assets
├── src/
│   ├── app/                    # App root, providers, and router
│   ├── contexts/               # Supabase auth and toast state
│   ├── lib/                    # Browser-safe Supabase client
│   ├── pages/                  # Login and dashboard page modules
│   ├── services/               # Admin data service
│   ├── types/                  # Database contracts
│   ├── admin.css               # Meridion admin design system
│   └── main.tsx                # Vite entrypoint
├── .env.example
├── vercel.json                 # SPA route fallback
└── README.md
```

The canonical database migration chain remains [`../paperloom/supabase/migrations`](../paperloom/supabase/migrations). The admin delivery-batch SQL snapshot is documented at [`docs/database/20261109_manual_delivery_batches.sql`](docs/database/20261109_manual_delivery_batches.sql); the live migration was applied to the shared Supabase project.

## Local development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The development server binds to port 3001. Use the same browser-safe Supabase URL and publishable key as the storefront:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Never use a service-role key in `.env.local` or browser code. The admin role is enforced by the database through `current_user_is_admin()` and the admin-only RPCs/policies.

## Access

Sign in with an existing Supabase Auth user that has the `admin` role in `public.user_roles`. The app checks `current_user_is_admin()` before loading dashboard data. A customer or seller account is denied. Do not add an email allow-list or a client-side role flag as a substitute for the database role check.

See the [Supabase README](../paperloom/supabase/README.md) for the trusted SQL that grants the owner account the admin role.

## Dashboard sections

- **Overview** — live counts and paid, delivered revenue from `admin_dashboard_summary()`; recent orders.
- **Heroes and promotions** — create, edit, publish and delete homepage content.
- **Products** — search all products (including drafts) through `admin_list_products()`, edit details, upload images, manage variants, publish/unpublish and moderate.
- **Categories** — create and edit catalog categories.
- **Orders** — view order details, delivery location, line items and vendor fulfilment state; manually group a customer's active orders into one delivery batch without merging their order records; schedule ready items first and create zero-duplicate-fee follow-up deliveries for pending items.
- **Inventory** — view stock records and adjust quantities with an audit reason.
- **Sellers** — review applications, inspect private verification documents through short-lived signed URLs, approve/reject/suspend shops.
- **Cases** — review buyer/vendor returns and complaints and record marketplace decisions.
- **Customers** — customer email, phone, order count and lifetime value from `admin_customer_summary()`.
- **Store settings** — store name, support email/phone/WhatsApp, standard delivery fee, free-delivery toggle, additional-delivery fee, COD availability and return window. Delivery fee changes are audited.
- **Audit log** — administrative actions recorded by database triggers/functions.

## Verification

```bash
pnpm typecheck
pnpm build
```

There are currently no separate test or lint scripts.

Some screens depend on the latest checkout/security migration. Until it is applied to the remote project, those screens will show a real database error (for example, a missing function) rather than mock data. Apply the canonical migrations and re-check the remote schema, RLS and storage buckets before treating the dashboard as production-ready.
