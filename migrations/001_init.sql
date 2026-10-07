CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  variant TEXT,
  stock_number TEXT UNIQUE,
  year INTEGER,
  price NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  mileage INTEGER,
  mileage_unit TEXT NOT NULL DEFAULT 'km',
  fuel TEXT,
  transmission TEXT,
  drive TEXT,
  engine TEXT,
  engine_size TEXT,
  power TEXT,
  torque TEXT,
  body_type TEXT,
  doors INTEGER,
  seats INTEGER,
  exterior_color TEXT,
  interior_color TEXT,
  first_registration TEXT,
  registration TEXT,
  registered_until TEXT,
  emission_class TEXT,
  location TEXT,
  availability TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  featured BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_translations (
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('mk', 'sq', 'en')),
  title TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  seo_title TEXT,
  seo_description TEXT,
  PRIMARY KEY (vehicle_id, locale)
);

CREATE TABLE IF NOT EXISTS vehicle_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  public_id TEXT,
  alt_mk TEXT,
  alt_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_cover BOOLEAN NOT NULL DEFAULT false,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_mk TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name_mk, name_en)
);

CREATE TABLE IF NOT EXISTS vehicle_features (
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  PRIMARY KEY (vehicle_id, feature_id)
);

CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  message TEXT,
  locale TEXT NOT NULL DEFAULT 'mk',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_public ON vehicles (published, status, featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle ON vehicle_images (vehicle_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries (created_at DESC);
