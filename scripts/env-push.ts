// Copies the Doppler prd config into the Vercel project's production environment (names from .env.example).
// Run: npm run env:push   (Doppler's Vercel integration is the upgrade; this is one command tonight.)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const names = readFileSync(".env.example", "utf8").split("\n").map((l) => /^([A-Z_]+)=/.exec(l)?.[1]).filter((n): n is string => Boolean(n));
for (const name of names) {
  const value = process.env[name] ?? "";
  if (!value) { console.log("empty, skipped:", name); continue; }
  try { execFileSync("vercel", ["env", "rm", name, "production", "--yes"], { stdio: "ignore" }); } catch { /* not there yet */ }
  execFileSync("vercel", ["env", "add", name, "production"], { input: value, stdio: ["pipe", "ignore", "inherit"] });
  console.log("set", name);
}
