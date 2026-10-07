require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const bcrypt = require("bcryptjs");
const cloudinary = require("cloudinary").v2;
const { getPool, query, withClient } = require("./db");

const app = express();
const PgSession = connectPgSimple(session);
const root = __dirname;
const port = process.env.PORT || 4173;

app.set("trust proxy", 1);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: process.env.DATABASE_URL
      ? new PgSession({
          pool: getPool(),
          createTableIfMissing: true
        })
      : undefined,
    secret: process.env.SESSION_SECRET || "dev-only-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

function requireAuth(req, res, next) {
  if (req.session?.adminUserId) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Unauthorized" });
  return res.redirect("/admin/login");
}

function sendPage(res, ...segments) {
  return res.sendFile(path.join(root, ...segments));
}

function publicVehicleWhere({ includeSold = true } = {}) {
  return includeSold
    ? "WHERE v.published = true AND v.status <> 'hidden'"
    : "WHERE v.published = true AND v.status NOT IN ('hidden', 'sold', 'draft')";
}

async function fetchVehicles({ lang = "mk", featured = false, admin = false } = {}) {
  const where = admin ? "" : publicVehicleWhere();
  const featuredClause = featured ? `${where ? " AND" : "WHERE"} v.featured = true` : "";
  const result = await query(
    `
    SELECT
      v.*,
      COALESCE(t.title, fallback_t.title, v.brand || ' ' || v.model) AS title,
      COALESCE(t.description, fallback_t.description, '') AS description,
      cover.url AS cover_url,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', img.id, 'url', img.url, 'sortOrder', img.sort_order, 'isCover', img.is_cover))
        FILTER (WHERE img.id IS NOT NULL),
        '[]'
      ) AS images,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', f.id, 'mk', f.name_mk, 'en', f.name_en, 'category', f.category))
        FILTER (WHERE f.id IS NOT NULL),
        '[]'
      ) AS features
    FROM vehicles v
    LEFT JOIN vehicle_translations t ON t.vehicle_id = v.id AND t.locale = $1
    LEFT JOIN vehicle_translations fallback_t ON fallback_t.vehicle_id = v.id AND fallback_t.locale = 'en'
    LEFT JOIN vehicle_images cover ON cover.vehicle_id = v.id AND cover.is_cover = true
    LEFT JOIN vehicle_images img ON img.vehicle_id = v.id
    LEFT JOIN vehicle_features vf ON vf.vehicle_id = v.id
    LEFT JOIN features f ON f.id = vf.feature_id
    ${where}
    ${featuredClause}
    GROUP BY v.id, t.title, t.description, fallback_t.title, fallback_t.description, cover.url
    ORDER BY v.created_at DESC
    `,
    [lang]
  );
  return result.rows.map(normalizeVehicle);
}

async function fetchVehicle(slug, { lang = "mk", admin = false } = {}) {
  const result = await query(
    `
    SELECT
      v.*,
      COALESCE(t.title, fallback_t.title, v.brand || ' ' || v.model) AS title,
      COALESCE(t.description, fallback_t.description, '') AS description,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', img.id, 'url', img.url, 'sortOrder', img.sort_order, 'isCover', img.is_cover))
        FILTER (WHERE img.id IS NOT NULL),
        '[]'
      ) AS images,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', f.id, 'mk', f.name_mk, 'en', f.name_en, 'category', f.category))
        FILTER (WHERE f.id IS NOT NULL),
        '[]'
      ) AS features
    FROM vehicles v
    LEFT JOIN vehicle_translations t ON t.vehicle_id = v.id AND t.locale = $2
    LEFT JOIN vehicle_translations fallback_t ON fallback_t.vehicle_id = v.id AND fallback_t.locale = 'en'
    LEFT JOIN vehicle_images img ON img.vehicle_id = v.id
    LEFT JOIN vehicle_features vf ON vf.vehicle_id = v.id
    LEFT JOIN features f ON f.id = vf.feature_id
    WHERE ${admin ? "v.id::text = $1 OR v.slug = $1" : "v.slug = $1 AND v.published = true AND v.status <> 'hidden'"}
    GROUP BY v.id, t.title, t.description, fallback_t.title, fallback_t.description
    LIMIT 1
    `,
    [slug, lang]
  );
  return result.rows[0] ? normalizeVehicle(result.rows[0]) : null;
}

function normalizeVehicle(row) {
  const images = [...(row.images || [])].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const cover = images.find((image) => image.isCover) || images[0];
  return {
    id: row.id,
    slug: row.slug,
    brand: row.brand,
    model: row.model,
    variant: row.variant,
    stockNumber: row.stock_number,
    year: row.year,
    price: Number(row.price || 0),
    currency: row.currency,
    mileage: row.mileage,
    mileageUnit: row.mileage_unit,
    fuel: row.fuel,
    transmission: row.transmission,
    drive: row.drive,
    engine: row.engine,
    engineSize: row.engine_size,
    power: row.power,
    torque: row.torque,
    bodyType: row.body_type,
    doors: row.doors,
    seats: row.seats,
    exteriorColor: row.exterior_color,
    interiorColor: row.interior_color,
    firstRegistration: row.first_registration,
    location: row.location,
    availability: row.availability,
    status: row.status,
    featured: row.featured,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url || cover?.url || "",
    images,
    features: row.features || []
  };
}

function toDbVehicle(body) {
  return {
    slug: body.slug,
    brand: body.brand,
    model: body.model,
    variant: body.variant || null,
    stockNumber: body.stockNumber || null,
    year: body.year || null,
    price: body.price || 0,
    currency: body.currency || "EUR",
    mileage: body.mileage || null,
    mileageUnit: body.mileageUnit || "km",
    fuel: body.fuel || null,
    transmission: body.transmission || null,
    drive: body.drive || null,
    engine: body.engine || null,
    engineSize: body.engineSize || null,
    power: body.power || null,
    torque: body.torque || null,
    bodyType: body.bodyType || null,
    doors: body.doors || null,
    seats: body.seats || null,
    exteriorColor: body.exteriorColor || null,
    interiorColor: body.interiorColor || null,
    firstRegistration: body.firstRegistration || null,
    location: body.location || null,
    availability: body.availability || null,
    status: body.status || "draft",
    featured: Boolean(body.featured),
    published: Boolean(body.published)
  };
}

async function upsertVehicle(body, id = null) {
  return withClient(async (client) => {
    const vehicle = toDbVehicle(body);
    const params = [
      vehicle.slug,
      vehicle.brand,
      vehicle.model,
      vehicle.variant,
      vehicle.stockNumber,
      vehicle.year,
      vehicle.price,
      vehicle.currency,
      vehicle.mileage,
      vehicle.mileageUnit,
      vehicle.fuel,
      vehicle.transmission,
      vehicle.drive,
      vehicle.engine,
      vehicle.engineSize,
      vehicle.power,
      vehicle.torque,
      vehicle.bodyType,
      vehicle.doors,
      vehicle.seats,
      vehicle.exteriorColor,
      vehicle.interiorColor,
      vehicle.firstRegistration,
      vehicle.location,
      vehicle.availability,
      vehicle.status,
      vehicle.featured,
      vehicle.published
    ];
    const result = id
      ? await client.query(
          `UPDATE vehicles SET
            slug=$1, brand=$2, model=$3, variant=$4, stock_number=$5, year=$6, price=$7, currency=$8,
            mileage=$9, mileage_unit=$10, fuel=$11, transmission=$12, drive=$13, engine=$14,
            engine_size=$15, power=$16, torque=$17, body_type=$18, doors=$19, seats=$20,
            exterior_color=$21, interior_color=$22, first_registration=$23, location=$24,
            availability=$25, status=$26, featured=$27, published=$28, updated_at=now()
           WHERE id=$29 RETURNING id, slug`,
          [...params, id]
        )
      : await client.query(
          `INSERT INTO vehicles (
            slug, brand, model, variant, stock_number, year, price, currency, mileage, mileage_unit,
            fuel, transmission, drive, engine, engine_size, power, torque, body_type, doors, seats,
            exterior_color, interior_color, first_registration, location, availability, status, featured, published
           ) VALUES (${params.map((_, index) => `$${index + 1}`).join(",")})
           RETURNING id, slug`,
          params
        );

    const vehicleId = result.rows[0].id;
    for (const locale of ["mk", "en"]) {
      const translation = body.translations?.[locale] || {};
      await client.query(
        `INSERT INTO vehicle_translations (vehicle_id, locale, title, short_description, description, seo_title, seo_description)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (vehicle_id, locale) DO UPDATE SET
           title=EXCLUDED.title, short_description=EXCLUDED.short_description, description=EXCLUDED.description,
           seo_title=EXCLUDED.seo_title, seo_description=EXCLUDED.seo_description`,
        [
          vehicleId,
          locale,
          translation.title || `${vehicle.brand} ${vehicle.model}`,
          translation.shortDescription || null,
          translation.description || null,
          translation.seoTitle || null,
          translation.seoDescription || null
        ]
      );
    }

    await client.query("DELETE FROM vehicle_images WHERE vehicle_id=$1", [vehicleId]);
    for (const [index, image] of (body.images || []).entries()) {
      await client.query(
        `INSERT INTO vehicle_images (vehicle_id, url, public_id, alt_mk, alt_en, sort_order, is_cover, width, height)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          vehicleId,
          image.url,
          image.publicId || null,
          image.altMk || null,
          image.altEn || null,
          index,
          Boolean(image.isCover),
          image.width || null,
          image.height || null
        ]
      );
    }

    await client.query("DELETE FROM vehicle_features WHERE vehicle_id=$1", [vehicleId]);
    for (const featureId of body.featureIds || []) {
      await client.query("INSERT INTO vehicle_features (vehicle_id, feature_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [
        vehicleId,
        featureId
      ]);
    }

    return fetchVehicle(vehicleId, { lang: "en", admin: true });
  });
}

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await query("SELECT * FROM admin_users WHERE email=$1 LIMIT 1", [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    req.session.adminUserId = user.id;
    req.session.adminEmail = user.email;
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session?.adminUserId) return res.status(401).json({ error: "Unauthorized" });
  res.json({ user: { id: req.session.adminUserId, email: req.session.adminEmail } });
});

app.get("/api/public/vehicles", async (req, res, next) => {
  try {
    res.json({ vehicles: await fetchVehicles({ lang: req.query.lang || "mk", featured: req.query.featured === "true" }) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/public/vehicles/:slug", async (req, res, next) => {
  try {
    const vehicle = await fetchVehicle(req.params.slug, { lang: req.query.lang || "mk" });
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    res.json({ vehicle });
  } catch (error) {
    next(error);
  }
});

app.post("/api/public/inquiries", async (req, res, next) => {
  try {
    const { vehicleId, name, phone, email, message, locale } = req.body;
    const result = await query(
      `INSERT INTO inquiries (vehicle_id, name, phone, email, message, locale)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
      [vehicleId || null, name, phone, email || null, message || null, locale || "mk"]
    );
    res.status(201).json({ inquiry: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/dashboard", requireAuth, async (req, res, next) => {
  try {
    const stats = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE published = true)::int AS published,
        COUNT(*) FILTER (WHERE published = false OR status = 'draft')::int AS drafts,
        COUNT(*) FILTER (WHERE status = 'sold')::int AS sold,
        COUNT(*) FILTER (WHERE featured = true)::int AS featured
      FROM vehicles
    `);
    const inquiries = await query("SELECT COUNT(*)::int AS total FROM inquiries");
    const recentVehicles = await fetchVehicles({ lang: "mk", admin: true });
    const recentInquiries = await query(
      `SELECT i.*, v.brand, v.model FROM inquiries i LEFT JOIN vehicles v ON v.id = i.vehicle_id ORDER BY i.created_at DESC LIMIT 8`
    );
    res.json({
      stats: { ...stats.rows[0], inquiries: inquiries.rows[0].total },
      recentVehicles: recentVehicles.slice(0, 6),
      recentInquiries: recentInquiries.rows
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/vehicles", requireAuth, async (req, res, next) => {
  try {
    res.json({ vehicles: await fetchVehicles({ lang: req.query.lang || "mk", admin: true }) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/vehicles/:id", requireAuth, async (req, res, next) => {
  try {
    const vehicle = await fetchVehicle(req.params.id, { lang: req.query.lang || "mk", admin: true });
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    const translations = await query("SELECT * FROM vehicle_translations WHERE vehicle_id=$1", [vehicle.id]);
    vehicle.translations = Object.fromEntries(translations.rows.map((row) => [row.locale, row]));
    res.json({ vehicle });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/vehicles", requireAuth, async (req, res, next) => {
  try {
    res.status(201).json({ vehicle: await upsertVehicle(req.body) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/vehicles/:id", requireAuth, async (req, res, next) => {
  try {
    res.json({ vehicle: await upsertVehicle(req.body, req.params.id) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/vehicles/:id", requireAuth, async (req, res, next) => {
  try {
    await query("DELETE FROM vehicles WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/vehicles/:id/duplicate", requireAuth, async (req, res, next) => {
  try {
    const original = await fetchVehicle(req.params.id, { lang: "en", admin: true });
    if (!original) return res.status(404).json({ error: "Vehicle not found" });
    const body = {
      ...original,
      slug: `${original.slug}-copy-${Date.now()}`,
      stockNumber: `${original.stockNumber || "VVS"}-COPY`,
      published: false,
      featured: false,
      translations: {
        mk: { title: `${original.title} copy`, description: original.description },
        en: { title: `${original.title} copy`, description: original.description }
      },
      images: original.images,
      featureIds: original.features.map((feature) => feature.id)
    };
    res.status(201).json({ vehicle: await upsertVehicle(body) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/vehicles/:id/publish", requireAuth, async (req, res, next) => {
  try {
    const result = await query("UPDATE vehicles SET published = NOT published, updated_at = now() WHERE id=$1 RETURNING *", [
      req.params.id
    ]);
    res.json({ vehicle: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/features", requireAuth, async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM features ORDER BY name_mk ASC");
    res.json({ features: result.rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/features", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      "INSERT INTO features (name_mk, name_en, category) VALUES ($1,$2,$3) RETURNING *",
      [req.body.nameMk, req.body.nameEn, req.body.category || null]
    );
    res.status(201).json({ feature: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/inquiries", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT i.*, v.brand, v.model FROM inquiries i LEFT JOIN vehicles v ON v.id = i.vehicle_id ORDER BY i.created_at DESC`
    );
    res.json({ inquiries: result.rows });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/inquiries/:id", requireAuth, async (req, res, next) => {
  try {
    const result = await query("UPDATE inquiries SET status=$1 WHERE id=$2 RETURNING *", [req.body.status, req.params.id]);
    res.json({ inquiry: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/uploads/signature", requireAuth, (req, res) => {
  if (!process.env.CLOUDINARY_API_SECRET) {
    return res.status(501).json({ error: "Cloudinary is not configured. Add Cloudinary env vars." });
  }
  const timestamp = Math.round(Date.now() / 1000);
  const folder = req.body.folder || "vvs/vehicles";
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);
  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature
  });
});

app.get("/admin/login", (req, res) => {
  if (req.session?.adminUserId) return res.redirect("/admin/");
  sendPage(res, "admin", "login.html");
});

app.get("/admin", requireAuth, (req, res) => sendPage(res, "admin", "index.html"));
app.get("/admin/", requireAuth, (req, res) => sendPage(res, "admin", "index.html"));
app.get("/admin/admin.js", requireAuth, (req, res) => sendPage(res, "admin", "admin.js"));
app.get("/admin/login.js", (req, res) => sendPage(res, "admin", "login.js"));

app.get("/", (req, res) => res.redirect("/mk"));
app.get("/mk", (req, res) => sendPage(res, "mk", "index.html"));
app.get("/en", (req, res) => sendPage(res, "en", "index.html"));
app.get("/mk/", (req, res) => sendPage(res, "mk", "index.html"));
app.get("/en/", (req, res) => sendPage(res, "en", "index.html"));
app.get("/mk/vozila", (req, res) => sendPage(res, "mk", "vozila", "index.html"));
app.get("/en/vehicles", (req, res) => sendPage(res, "en", "vehicles", "index.html"));
app.get("/mk/vozila/", (req, res) => sendPage(res, "mk", "vozila", "index.html"));
app.get("/en/vehicles/", (req, res) => sendPage(res, "en", "vehicles", "index.html"));
app.get("/mk/za-nas", (req, res) => sendPage(res, "mk", "za-nas", "index.html"));
app.get("/en/about", (req, res) => sendPage(res, "en", "about", "index.html"));
app.get("/mk/kontakt", (req, res) => sendPage(res, "mk", "kontakt", "index.html"));
app.get("/en/contact", (req, res) => sendPage(res, "en", "contact", "index.html"));
app.get("/mk/za-nas/", (req, res) => sendPage(res, "mk", "za-nas", "index.html"));
app.get("/en/about/", (req, res) => sendPage(res, "en", "about", "index.html"));
app.get("/mk/kontakt/", (req, res) => sendPage(res, "mk", "kontakt", "index.html"));
app.get("/en/contact/", (req, res) => sendPage(res, "en", "contact", "index.html"));
app.get("/mk/vozila/:slug.html", (req, res) => sendPage(res, "vehicle-detail.html"));
app.get("/en/vehicles/:slug.html", (req, res) => sendPage(res, "vehicle-detail.html"));

app.use(express.static(root, { extensions: ["html"] }));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Server error" });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`VVS server running on http://127.0.0.1:${port}`);
  });
}

module.exports = app;
