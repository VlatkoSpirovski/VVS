import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=disable") ? false : { rejectUnauthorized: false }
});

const vehicles = [
  {
    slug: "bmw-m340i-xdrive",
    brand: "BMW",
    model: "M340i xDrive",
    variant: "M Sport",
    stock_number: "VVS-2401",
    year: 2024,
    price: 54900,
    mileage: 18500,
    fuel: "petrol",
    transmission: "Automatic",
    drive: "xDrive",
    engine: "3.0L inline-six",
    power: "374 HP",
    body_type: "Sedan",
    exterior_color: "Black Sapphire",
    status: "published",
    featured: true,
    published: true,
    images: [
      "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1600&q=82",
      "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?auto=format&fit=crop&w=1600&q=82",
      "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1600&q=82"
    ],
    translations: {
      mk: {
        title: "BMW M340i xDrive",
        description: "Модерен спортски седан со силни перформанси, мирна премиум кабина и спецификација за секојдневно возење."
      },
      en: {
        title: "BMW M340i xDrive",
        description: "A precise, modern performance sedan with a calm premium cabin, strong specification, and everyday usability."
      }
    },
    features: [
      ["M Sport пакет", "M Sport package"],
      ["Адаптивен темпомат", "Adaptive cruise"],
      ["Harman Kardon", "Harman Kardon"],
      ["360° камера", "360° camera"]
    ]
  },
  {
    slug: "mercedes-benz-gle-400d",
    brand: "Mercedes-Benz",
    model: "GLE 400d",
    variant: "4MATIC AMG Line",
    stock_number: "VVS-2309",
    year: 2023,
    price: 78900,
    mileage: 29200,
    fuel: "diesel",
    transmission: "Automatic",
    drive: "4MATIC",
    engine: "3.0L six-cylinder",
    power: "330 HP",
    body_type: "SUV",
    exterior_color: "Obsidian Black",
    status: "published",
    featured: true,
    published: true,
    images: [
      "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1600&q=82",
      "https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&w=1600&q=82"
    ],
    translations: {
      mk: {
        title: "Mercedes-Benz GLE 400d",
        description: "Луксузен SUV со тивка кабина, силно присуство на пат и комфор за долги релации."
      },
      en: {
        title: "Mercedes-Benz GLE 400d",
        description: "A confident luxury SUV with a quiet cabin, serious road presence, and long-distance comfort."
      }
    },
    features: [
      ["AMG екстериер", "AMG exterior"],
      ["Воздушна суспензија", "Air suspension"],
      ["Панорамски покрив", "Panoramic roof"],
      ["Burmester аудио", "Burmester audio"]
    ]
  }
];

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await client.query(
    `INSERT INTO admin_users (email, password_hash, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [process.env.ADMIN_EMAIL, passwordHash, "VVS Admin"]
  );

  await client.query(
    `INSERT INTO site_settings (key, value)
     VALUES ('company', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [
      JSON.stringify({
        companyName: "VVS Auto",
        phones: ["+389 78 427 074", "+389 78 391 140"],
        email: "",
        address: "Skopje, North Macedonia",
        openingHours: "По договор"
      })
    ]
  );

  for (const vehicle of vehicles) {
    const result = await client.query(
      `INSERT INTO vehicles (
        slug, brand, model, variant, stock_number, year, price, mileage, fuel, transmission, drive,
        engine, power, body_type, exterior_color, status, featured, published
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (slug) DO UPDATE SET
        brand = EXCLUDED.brand, model = EXCLUDED.model, variant = EXCLUDED.variant, price = EXCLUDED.price,
        mileage = EXCLUDED.mileage, status = EXCLUDED.status, featured = EXCLUDED.featured, published = EXCLUDED.published,
        updated_at = now()
      RETURNING id`,
      [
        vehicle.slug,
        vehicle.brand,
        vehicle.model,
        vehicle.variant,
        vehicle.stock_number,
        vehicle.year,
        vehicle.price,
        vehicle.mileage,
        vehicle.fuel,
        vehicle.transmission,
        vehicle.drive,
        vehicle.engine,
        vehicle.power,
        vehicle.body_type,
        vehicle.exterior_color,
        vehicle.status,
        vehicle.featured,
        vehicle.published
      ]
    );
    const vehicleId = result.rows[0].id;

    for (const [locale, translation] of Object.entries(vehicle.translations)) {
      await client.query(
        `INSERT INTO vehicle_translations (vehicle_id, locale, title, description, seo_title, seo_description)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (vehicle_id, locale) DO UPDATE SET
           title = EXCLUDED.title, description = EXCLUDED.description, seo_title = EXCLUDED.seo_title, seo_description = EXCLUDED.seo_description`,
        [vehicleId, locale, translation.title, translation.description, translation.title, translation.description]
      );
    }

    await client.query("DELETE FROM vehicle_images WHERE vehicle_id = $1", [vehicleId]);
    for (const [index, url] of vehicle.images.entries()) {
      await client.query(
        `INSERT INTO vehicle_images (vehicle_id, url, sort_order, is_cover)
         VALUES ($1,$2,$3,$4)`,
        [vehicleId, url, index, index === 0]
      );
    }

    for (const [nameMk, nameEn] of vehicle.features) {
      const feature = await client.query(
        `INSERT INTO features (name_mk, name_en)
         VALUES ($1,$2)
         ON CONFLICT (name_mk, name_en) DO UPDATE SET name_mk = EXCLUDED.name_mk
         RETURNING id`,
        [nameMk, nameEn]
      );
      await client.query(
        `INSERT INTO vehicle_features (vehicle_id, feature_id)
         VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [vehicleId, feature.rows[0].id]
      );
    }
  }

  await client.query("COMMIT");
  console.log("Seed complete.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
