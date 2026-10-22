# SQLite backend (opt-in)

Set DATABASE_PROVIDER=sqlite and SQLITE_DATABASE_PATH=/persistent/path/anit.sqlite. The app initializes eight tables at first database access; it never seeds real products or copies Supabase data automatically.

## Supported routes
- GET /api/products (SQLite)
- GET, POST, PATCH /api/orders (SQLite, existing Supabase authentication retained temporarily)

## Not yet migrated
Supabase Auth, account/profile updates, admin product CRUD, shipping quote endpoints and external payment webhook integration still use Supabase. **Do not enable SQLite in production** until those routes are migrated and data is copied. SQLite order operations deliberately reject checkout with shipping enabled until the shipping backend is implemented.

SQLite is a single-file database and requires a persistent writable disk and one shared writer endpoint; a normal Vercel serverless deployment does not provide a suitable shared persistent filesystem. Run on a persistent Node.js host or choose another hosted DB.

## Importing from PostgreSQL
Export a consistent snapshot (users/profiles/products/orders/items/history/audit/shipping_quotes), preserve existing UUIDs and convert monetary amounts to integer cents. Test entity counts and foreign keys after import. Do not export Supabase password hashes into an unsupported local authentication flow. Never expose SQLITE_DATABASE_PATH or the database file publicly.

## Security
Supabase Auth still issues bearer tokens; the SQLite backend checks their validity through Supabase, then enforces ownership and admin roles server-side. New accounts are provisioned with role=user and existing administrators must be explicitly imported/provisioned by a trusted operator, not promoted by clients.
