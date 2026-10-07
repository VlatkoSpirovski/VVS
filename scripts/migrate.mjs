import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Add your Neon connection string to .env.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=disable") ? false : { rejectUnauthorized: false }
});

const migrationsDir = new URL("../migrations/", import.meta.url);
const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

for (const file of files) {
  const sql = await readFile(new URL(file, migrationsDir), "utf8");
  await pool.query(sql);
  console.log(`Applied ${file}`);
}

await pool.end();
console.log("Database migration complete.");
