/**
 * Fixed-window in-memory rate limiter. Good enough for a single Node process;
 * on multi-instance or serverless deployments swap the store for Redis/Upstash.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Records an attempt. Returns whether it is allowed and seconds until the window resets. */
  hit(key: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
    this.prune(now);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfter: 0 };
    }
    entry.count += 1;
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: entry.count <= this.limit, retryAfter };
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private prune(now: number) {
    if (this.hits.size < 10_000) return;
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}
