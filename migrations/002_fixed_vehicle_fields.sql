ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS registration TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS registered_until TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS emission_class TEXT;

ALTER TABLE vehicle_translations DROP CONSTRAINT IF EXISTS vehicle_translations_locale_check;
ALTER TABLE vehicle_translations
  ADD CONSTRAINT vehicle_translations_locale_check CHECK (locale IN ('mk', 'sq', 'en'));
