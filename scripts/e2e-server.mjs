// Prepares a fresh seeded database (e2e.db) and starts the production server on the given port.
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const port = process.argv[2] ?? "3100";
if (!/^\d+$/.test(port)) throw new Error(`Invalid port: ${port}`);
const env = { ...process.env, DATABASE_URL: "file:e2e.db" };

for (const f of ["e2e.db", "e2e.db-journal", "e2e.db-wal", "e2e.db-shm"]) rmSync(f, { force: true });
execSync("npx drizzle-kit push --force", { env, stdio: "inherit" });
execSync("npx tsx scripts/seed.ts", { env, stdio: "inherit" });

const server = spawn("npx", ["next", "start", "-p", port], { env, stdio: "inherit", shell: true });
process.on("SIGTERM", () => server.kill());
process.on("SIGINT", () => server.kill());
