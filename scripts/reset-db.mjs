// Deletes the local SQLite database files so db:push starts from a clean schema.
import { rmSync } from "node:fs";
for (const f of ["local.db", "local.db-journal", "local.db-wal", "local.db-shm"]) rmSync(f, { force: true });
console.log("Local database removed.");
