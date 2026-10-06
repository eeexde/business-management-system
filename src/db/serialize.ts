import type { Client, Transaction, TransactionMode } from "@libsql/client";

/** Minimal FIFO async mutex. */
export class Mutex {
  private tail: Promise<void> = Promise.resolve();

  lock(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const acquired = this.tail.then(() => release);
    this.tail = this.tail.then(() => next);
    return acquired;
  }
}

/**
 * Local SQLite (libSQL file mode) executes statements synchronously in this process, and a
 * write transaction holds the database lock across `await`s. A second pooled connection
 * therefore can't wait for it (any busy-wait would block the very thread holding the lock),
 * so concurrent writes fail with SQLITE_BUSY.
 *
 * This wraps the client so every operation takes a process-wide async lock, and a
 * transaction keeps it until commit/rollback/close. Requests queue instead of failing.
 * Rule this relies on: code inside db.transaction() must use `tx`, never `db`.
 */
export function serializeClient(client: Client): Client {
  const mutex = new Mutex();

  const guarded =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const release = await mutex.lock();
      try {
        return await fn(...args);
      } finally {
        release();
      }
    };

  async function transaction(mode?: TransactionMode): Promise<Transaction> {
    const release = await mutex.lock();
    let released = false;
    const releaseOnce = () => {
      if (!released) {
        released = true;
        release();
      }
    };
    let tx: Transaction;
    try {
      tx = await client.transaction(mode);
    } catch (err) {
      releaseOnce();
      throw err;
    }
    const commit = tx.commit.bind(tx);
    const rollback = tx.rollback.bind(tx);
    const close = tx.close.bind(tx);
    tx.commit = async () => {
      try {
        await commit();
      } finally {
        releaseOnce();
      }
    };
    tx.rollback = async () => {
      try {
        await rollback();
      } finally {
        releaseOnce();
      }
    };
    tx.close = () => {
      try {
        close();
      } finally {
        releaseOnce();
      }
    };
    return tx;
  }

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "transaction") return transaction;
      if (prop === "execute" || prop === "batch" || prop === "executeMultiple" || prop === "migrate") {
        const fn = Reflect.get(target, prop, receiver) as (...args: unknown[]) => Promise<unknown>;
        return guarded(fn.bind(target));
      }
      const value = Reflect.get(target, prop, receiver);
      // The client uses #private fields, so methods must run with the real client as `this`.
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
