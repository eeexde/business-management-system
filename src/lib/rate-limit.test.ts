import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit within a window, then blocks", () => {
    const rl = new RateLimiter(3, 60_000);
    expect(rl.hit("a", 0).allowed).toBe(true);
    expect(rl.hit("a", 1).allowed).toBe(true);
    expect(rl.hit("a", 2).allowed).toBe(true);
    const blocked = rl.hit("a", 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(60);
  });

  it("keys are independent and windows reset", () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.hit("a", 0).allowed).toBe(true);
    expect(rl.hit("b", 0).allowed).toBe(true);
    expect(rl.hit("a", 500).allowed).toBe(false);
    expect(rl.hit("a", 1000).allowed).toBe(true);
  });

  it("reset clears a key", () => {
    const rl = new RateLimiter(1, 1000);
    rl.hit("a", 0);
    rl.reset("a");
    expect(rl.hit("a", 1).allowed).toBe(true);
  });
});
