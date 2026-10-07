import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const htmlFiles = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    if (stat.isFile() && path.endsWith(".html")) htmlFiles.push(path);
  }
}

walk(root);

const required = ["+389 78 427 074", "+389 78 391 140", "/assets/vvs-auto-logo.jpeg"];
const allHtml = htmlFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const missing = required.filter((item) => !allHtml.includes(item));

if (!htmlFiles.length) {
  throw new Error("No HTML files found.");
}

if (missing.length) {
  throw new Error(`Missing required content: ${missing.join(", ")}`);
}

console.log(`Checked ${htmlFiles.length} HTML files.`);
