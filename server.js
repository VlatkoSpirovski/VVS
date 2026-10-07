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
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET || (isProduction ? null : "dev-only-change-me");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VEHICLE_STATUSES = new Set(["published", "draft", "reserved", "sold", "hidden"]);
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_FAILURES_PER_ACCOUNT = 5;
const LOGIN_MAX_FAILURES_PER_IP = 20;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("vvs-timing-guard", 12);

if (!sessionSecret) {
  console.error("SESSION_SECRET is not set. Admin login is disabled until it is added.");
}

app.set("trust proxy", 1);
app.disable("x-powered-by");

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://api.cloudinary.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join("; ");

app.use((req, res, next) => {
  res.set({
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  });
  if (isProduction) res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (req.path.startsWith("/admin") || req.path.startsWith("/api/admin") || req.path.startsWith("/api/auth")) {
    res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
  }
  next();
});

app.use(express.json({ limit: "2mb" }));

app.use(
  session({
    store: process.env.DATABASE_URL
      ? new PgSession({
          pool: getPool(),
          createTableIfMissing: true
        })
      : undefined,
    name: "vvs.sid",
    secret: sessionSecret || "admin-login-disabled-" + Math.random().toString(36).slice(2),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
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
    registration: row.registration,
    registeredUntil: row.registered_until,
    emissionClass: row.emission_class,
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

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  error.expose = true;
  return error;
}

function cleanText(value, field, max = 200) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") throw badRequest(`${field} is invalid`);
  const text = String(value).trim();
  if (text.length > max) throw badRequest(`${field} is too long (max ${max} characters)`);
  return text || null;
}

function cleanNumber(value, field, { min = 0, max, integer = false } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
    throw badRequest(`${field} is invalid`);
  }
  return number;
}

function validateVehicle(body) {
  if (!body || typeof body !== "object") throw badRequest("Vehicle data is missing");
  const brand = cleanText(body.brand, "Brand", 80);
  const model = cleanText(body.model, "Model", 80);
  if (!brand || !model) throw badRequest("Brand and model are required");
  const slug = cleanText(body.slug, "Slug", 160);
  if (!slug || !SLUG_PATTERN.test(slug)) throw badRequest("Slug may only contain a-z, 0-9 and dashes");
  const status = body.status || "draft";
  if (!VEHICLE_STATUSES.has(status)) throw badRequest("Status is invalid");
  if (body.currency && !["EUR", "MKD"].includes(body.currency)) throw badRequest("Currency is invalid");

  const images = Array.isArray(body.images) ? body.images : [];
  if (images.length > 60) throw badRequest("A vehicle can have at most 60 photos");
  for (const image of images) {
    if (typeof image?.url !== "string" || !/^https:\/\/[^\s"'<>]+$/.test(image.url) || image.url.length > 600) {
      throw badRequest("Photo URL is invalid");
    }
  }
  const featureIds = Array.isArray(body.featureIds) ? body.featureIds : [];
  if (featureIds.some((id) => !UUID_PATTERN.test(String(id)))) throw badRequest("Feature is invalid");

  const translations = {};
  for (const locale of ["mk", "sq", "en"]) {
    const translation = body.translations?.[locale] || {};
    translations[locale] = {
      title: cleanText(translation.title, "Title", 200),
      shortDescription: cleanText(translation.shortDescription, "Short description", 500),
      description: cleanText(translation.description, "Description", 10000),
      seoTitle: cleanText(translation.seoTitle, "SEO title", 200),
      seoDescription: cleanText(translation.seoDescription, "SEO description", 500)
    };
  }

  const textFields = [
    "variant", "stockNumber", "mileageUnit", "fuel", "transmission", "drive", "engine", "engineSize", "power",
    "torque", "bodyType", "exteriorColor", "interiorColor", "firstRegistration", "registration",
    "registeredUntil", "emissionClass", "location", "availability"
  ];
  const clean = Object.fromEntries(textFields.map((field) => [field, cleanText(body[field], field, 120)]));
  const thisYear = new Date().getFullYear();

  return {
    ...clean,
    slug,
    brand,
    model,
    status,
    currency: body.currency || "EUR",
    year: cleanNumber(body.year, "Year", { min: 1900, max: thisYear + 1, integer: true }),
    price: cleanNumber(body.price, "Price", { max: 100000000 }) || 0,
    mileage: cleanNumber(body.mileage, "Mileage", { max: 5000000, integer: true }),
    doors: cleanNumber(body.doors, "Doors", { max: 10, integer: true }),
    seats: cleanNumber(body.seats, "Seats", { max: 60, integer: true }),
    featured: Boolean(body.featured),
    published: Boolean(body.published),
    translations,
    images: images.map((image) => ({
      url: image.url,
      publicId: cleanText(image.publicId, "Photo id", 300),
      altMk: cleanText(image.altMk, "Photo text", 300),
      altEn: cleanText(image.altEn, "Photo text", 300),
      isCover: Boolean(image.isCover),
      width: cleanNumber(image.width, "Photo width", { max: 100000, integer: true }),
      height: cleanNumber(image.height, "Photo height", { max: 100000, integer: true })
    })),
    featureIds
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
    registration: body.registration || null,
    registeredUntil: body.registeredUntil || null,
    emissionClass: body.emissionClass || null,
    location: body.location || null,
    availability: body.availability || null,
    status: body.status || "draft",
    featured: Boolean(body.featured),
    published: Boolean(body.published)
  };
}

async function upsertVehicle(input, id = null) {
  const body = validateVehicle(input);
  const vehicleId = await withClient(async (client) => {
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
      vehicle.registration,
      vehicle.registeredUntil,
      vehicle.emissionClass,
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
            exterior_color=$21, interior_color=$22, first_registration=$23, registration=$24,
            registered_until=$25, emission_class=$26, location=$27, availability=$28, status=$29,
            featured=$30, published=$31, updated_at=now()
           WHERE id=$32 RETURNING id, slug`,
          [...params, id]
        )
      : await client.query(
          `INSERT INTO vehicles (
            slug, brand, model, variant, stock_number, year, price, currency, mileage, mileage_unit,
            fuel, transmission, drive, engine, engine_size, power, torque, body_type, doors, seats,
            exterior_color, interior_color, first_registration, registration, registered_until, emission_class,
            location, availability, status, featured, published
           ) VALUES (${params.map((_, index) => `$${index + 1}`).join(",")})
           RETURNING id, slug`,
          params
        );

    const vehicleId = result.rows[0].id;
    for (const locale of ["mk", "sq", "en"]) {
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

    return vehicleId;
  });
  return fetchVehicle(vehicleId, { lang: "en", admin: true });
}

let loginAttemptsReady = null;

function ensureLoginAttemptsTable() {
  loginAttemptsReady ||= query(`
    CREATE TABLE IF NOT EXISTS admin_login_failures (
      id BIGSERIAL PRIMARY KEY,
      ip TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_admin_login_failures_created ON admin_login_failures (created_at);
  `).catch((error) => {
    loginAttemptsReady = null;
    throw error;
  });
  return loginAttemptsReady;
}

async function isLoginLocked(ip, email) {
  await ensureLoginAttemptsTable();
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE email = $2)::int AS account_failures,
       COUNT(*) FILTER (WHERE ip = $1)::int AS ip_failures
     FROM admin_login_failures
     WHERE created_at > now() - make_interval(mins => $3)`,
    [ip, email, LOGIN_WINDOW_MINUTES]
  );
  const { account_failures: accountFailures, ip_failures: ipFailures } = result.rows[0];
  return accountFailures >= LOGIN_MAX_FAILURES_PER_ACCOUNT || ipFailures >= LOGIN_MAX_FAILURES_PER_IP;
}

async function recordLoginFailure(ip, email) {
  await query("INSERT INTO admin_login_failures (ip, email) VALUES ($1, $2)", [ip, email]);
  await query("DELETE FROM admin_login_failures WHERE created_at < now() - interval '1 day'");
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => req.session.regenerate((error) => (error ? reject(error) : resolve())));
}

function saveSession(req) {
  return new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));
}

app.post("/api/auth/login", async (req, res, next) => {
  try {
    if (!sessionSecret) return res.status(503).json({ error: "Admin login is not configured" });
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 200) : "";
    const password = typeof req.body?.password === "string" ? req.body.password.slice(0, 200) : "";
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const ip = req.ip || "unknown";
    if (await isLoginLocked(ip, email)) {
      return res.status(429).json({ error: `Too many attempts. Try again in ${LOGIN_WINDOW_MINUTES} minutes.` });
    }

    const result = await query("SELECT id, email, name, password_hash FROM admin_users WHERE lower(email)=$1 LIMIT 1", [email]);
    const user = result.rows[0];
    const passwordOk = await bcrypt.compare(password, user?.password_hash || DUMMY_PASSWORD_HASH);
    if (!user || !passwordOk) {
      await recordLoginFailure(ip, email);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    await query("DELETE FROM admin_login_failures WHERE email=$1", [email]);
    await regenerateSession(req);
    req.session.adminUserId = user.id;
    req.session.adminEmail = user.email;
    await saveSession(req);
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("vvs.sid");
    res.json({ ok: true });
  });
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

function requireUuidParam(req, res, next) {
  if (!UUID_PATTERN.test(req.params.id || "")) return res.status(404).json({ error: "Not found" });
  next();
}

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

app.get("/api/admin/vehicles/:id", requireAuth, requireUuidParam, async (req, res, next) => {
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

app.put("/api/admin/vehicles/:id", requireAuth, requireUuidParam, async (req, res, next) => {
  try {
    const exists = await query("SELECT 1 FROM vehicles WHERE id=$1", [req.params.id]);
    if (!exists.rowCount) return res.status(404).json({ error: "Vehicle not found" });
    res.json({ vehicle: await upsertVehicle(req.body, req.params.id) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/vehicles/:id", requireAuth, requireUuidParam, async (req, res, next) => {
  try {
    const result = await query("DELETE FROM vehicles WHERE id=$1", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Vehicle not found" });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/vehicles/:id/duplicate", requireAuth, requireUuidParam, async (req, res, next) => {
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
        sq: { title: `${original.title} copy`, description: original.description },
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

app.patch("/api/admin/vehicles/:id/publish", requireAuth, requireUuidParam, async (req, res, next) => {
  try {
    const result = await query("UPDATE vehicles SET published = NOT published, updated_at = now() WHERE id=$1 RETURNING *", [
      req.params.id
    ]);
    if (!result.rowCount) return res.status(404).json({ error: "Vehicle not found" });
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
    if (!cleanText(req.body?.nameMk, "Name", 120) || !cleanText(req.body?.nameEn, "Name", 120)) {
      return res.status(400).json({ error: "Name in both languages is required" });
    }
    const result = await query(
      "INSERT INTO features (name_mk, name_en, category) VALUES ($1,$2,$3) RETURNING *",
      [cleanText(req.body?.nameMk, "Name", 120), cleanText(req.body?.nameEn, "Name", 120), cleanText(req.body?.category, "Category", 80)]
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

app.patch("/api/admin/inquiries/:id", requireAuth, requireUuidParam, async (req, res, next) => {
  try {
    if (!["new", "contacted", "closed"].includes(req.body?.status)) return res.status(400).json({ error: "Status is invalid" });
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
  const folder = "vvs/vehicles";
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
app.get("/admin/admin.css", (req, res) => sendPage(res, "admin", "admin.css"));

function siteUrl(req) {
  const configured = (process.env.SITE_URL || "").replace(/\/+$/, "");
  return configured || `${req.protocol}://${req.get("host")}`;
}

function xmlEscape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

app.get("/sitemap.xml", async (req, res, next) => {
  try {
    const base = siteUrl(req);
    const pairs = [
      ["/mk/", "/en/", "1.0", "daily"],
      ["/mk/vozila/", "/en/vehicles/", "0.9", "daily"],
      ["/mk/za-nas/", "/en/about/", "0.5", "monthly"],
      ["/mk/kontakt/", "/en/contact/", "0.6", "monthly"]
    ];
    const vehicles = await fetchVehicles({ lang: "mk" });
    for (const vehicle of vehicles) {
      if (!vehicle.slug) continue;
      const slug = encodeURIComponent(vehicle.slug);
      const lastmod = new Date(vehicle.updatedAt || vehicle.createdAt || Date.now()).toISOString().slice(0, 10);
      pairs.push([`/mk/vozila/${slug}`, `/en/vehicles/${slug}`, vehicle.status === "sold" ? "0.4" : "0.8", "weekly", lastmod]);
    }
    const entry = (path, mk, en, priority, changefreq, lastmod) => `  <url>
    <loc>${xmlEscape(base + path)}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="mk" href="${xmlEscape(base + mk)}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(base + en)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(base + mk)}"/>
  </url>`;
    const urls = pairs.flatMap(([mk, en, priority, changefreq, lastmod]) => [
      entry(mk, mk, en, priority, changefreq, lastmod),
      entry(en, mk, en, priority, changefreq, lastmod)
    ]);
    res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`);
  } catch (error) {
    next(error);
  }
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${siteUrl(req)}/sitemap.xml
`);
});

app.get("/", (req, res) => res.redirect("/mk"));
app.get(["/vehicles", "/vehicles/"], (req, res) => res.redirect(301, "/en/vehicles/"));
app.get("/vehicles/:slug.html", (req, res) => res.redirect(301, `/en/vehicles/${encodeURIComponent(req.params.slug)}`));
app.get(["/about", "/about/"], (req, res) => res.redirect(301, "/en/about/"));
app.get(["/contact", "/contact/"], (req, res) => res.redirect(301, "/en/contact/"));
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
app.get("/mk/vozila/:slug.html", (req, res) => res.redirect(301, `/mk/vozila/${encodeURIComponent(req.params.slug)}`));
app.get("/en/vehicles/:slug.html", (req, res) => res.redirect(301, `/en/vehicles/${encodeURIComponent(req.params.slug)}`));
app.get("/mk/vozila/:slug", (req, res) => sendPage(res, "vehicle-detail.html"));
app.get("/en/vehicles/:slug", (req, res) => sendPage(res, "vehicle-detail.html"));

app.get(["/styles.css", "/app.js", "/data.js"], (req, res) => sendPage(res, req.path.slice(1)));
app.use("/assets", express.static(path.join(root, "assets"), { fallthrough: false, index: false, dotfiles: "deny" }));

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.status(404).type("text/plain").send("Not found");
});

app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed" || error.type === "entity.too.large") {
    return res.status(error.status || 400).json({ error: "Request body is invalid" });
  }
  if (error.expose && error.status) return res.status(error.status).json({ error: error.message });
  if (error.code === "23505") return res.status(409).json({ error: "A vehicle with this slug already exists" });
  if (error.status === 404) return res.status(404).type("text/plain").send("Not found");
  console.error(error);
  res.status(500).json({ error: "Server error" });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`VVS server running on http://127.0.0.1:${port}`);
  });
}

module.exports = app;
