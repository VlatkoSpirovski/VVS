import "dotenv/config";
import { readFile } from "node:fs/promises";
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

const sql = await readFile(new URL("../migrations/001_init.sql", import.meta.url), "utf8");
await pool.query(sql);
await pool.end();
console.log("Database migration complete.");
