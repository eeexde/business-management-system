import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Mutex, serializeClient } from "./serialize";

describe("Mutex", () => {
  it("runs critical sections one at a time in FIFO order", async () => {
    const m = new Mutex();
    const log: string[] = [];
    const task = async (name: string) => {
      const release = await m.lock();
      log.push(`${name}:start`);
      await new Promise((r) => setTimeout(r, 5));
      log.push(`${name}:end`);
      release();
    };
    await Promise.all([task("a"), task("b"), task("c")]);
    expect(log).toEqual(["a:start", "a:end", "b:start", "b:end", "c:start", "c:end"]);
  });
});

describe("serializeClient (local SQLite file)", () => {
  let dir: string;
  let client: Client;

  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "bizdesk-db-"));
    client = serializeClient(createClient({ url: `file:${path.join(dir, "t.db")}` }));
    await client.execute("create table t (id integer primary key, v text)");
  });

  afterEach(() => {
    client.close();
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    } catch {
      // Windows can hold the file handle briefly after close; a leftover temp dir is harmless.
    }
  });

  it("queues concurrent transactions and plain writes instead of failing with SQLITE_BUSY", async () => {
    const jobs = Array.from({ length: 12 }, async (_, i) => {
      if (i % 2) return client.execute({ sql: "insert into t (v) values (?)", args: [`plain${i}`] });
      const tx = await client.transaction("write");
      try {
        await tx.execute({ sql: "insert into t (v) values (?)", args: [`tx${i}`] });
        await new Promise((r) => setTimeout(r, 10));
        await tx.commit();
      } finally {
        tx.close();
      }
    });
    const results = await Promise.allSettled(jobs);
    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    const { rows } = await client.execute("select count(*) as n from t");
    expect(Number(rows[0]!.n)).toBe(12);
  });

  it("releases the lock after a rollback", async () => {
    const tx = await client.transaction("write");
    await tx.execute("insert into t (v) values ('x')");
    await tx.rollback();
    tx.close();
    await client.execute("insert into t (v) values ('y')");
    const { rows } = await client.execute("select v from t");
    expect(rows.map((r) => r.v)).toEqual(["y"]);
  });
});
