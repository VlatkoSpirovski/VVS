# VVS Website + Real Admin Backend

This project now uses a real Node/Express backend with PostgreSQL as the source of truth.

## Required Environment

Copy `.env.example` to `.env` and fill in:

```bash
DATABASE_URL="your Neon PostgreSQL connection string"
SESSION_SECRET="long random string"
ADMIN_EMAIL="admin email"
ADMIN_PASSWORD="initial admin password"
```

Optional Cloudinary image upload:

```bash
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
```

## Setup

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Admin:

```text
http://127.0.0.1:4173/admin/login
```

Public:

```text
http://127.0.0.1:4173/mk/
http://127.0.0.1:4173/en/
```

## Architecture

- Public website loads vehicles from `/api/public/vehicles`.
- Admin uses protected `/api/admin/*` routes.
- Sessions are stored in PostgreSQL.
- Vehicles, translations, images, features, inquiries, settings, and admin users are stored in PostgreSQL.
- Cloudinary upload signatures are generated server-side when Cloudinary credentials are configured.

Without `DATABASE_URL`, API routes intentionally fail with a clear setup error.
