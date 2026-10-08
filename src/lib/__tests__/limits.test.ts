import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fixedWindow: vi.fn(() => "window"),
  getRemaining: vi.fn(),
  limit: vi.fn(),
  redisConstructor: vi.fn(),
  ratelimitConstructor: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(options: unknown) {
      mocks.redisConstructor(options);
    }
  },
}));

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static fixedWindow = mocks.fixedWindow;
    getRemaining = mocks.getRemaining;
    limit = mocks.limit;

    constructor(options: unknown) {
      mocks.ratelimitConstructor(options);
    }
  }
  return { Ratelimit };
});

describe("message limits", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows requests and reports the full allowance without credentials", async () => {
    const { getRemainingMessages, limitMessages } = await import("../limits");

    await expect(getRemainingMessages("user-1")).resolves.toEqual({ remaining: 50 });
    await expect(limitMessages("user-1")).resolves.toBeUndefined();
    expect(mocks.ratelimitConstructor).not.toHaveBeenCalled();
  });

  it("configures and returns results from Upstash when credentials exist", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    mocks.getRemaining.mockResolvedValue({ remaining: 12, reset: 1234 });
    const success = { success: true, remaining: 11, reset: 1234 };
    mocks.limit.mockResolvedValue(success);

    const { getRemainingMessages, limitMessages } = await import("../limits");

    expect(mocks.fixedWindow).toHaveBeenCalledWith(50, "1 d");
    await expect(getRemainingMessages("user-2")).resolves.toEqual({
      remaining: 12,
      reset: 1234,
    });
    await expect(limitMessages("user-2")).resolves.toBe(success);
  });

  it("throws when the limiter rejects the request", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    mocks.limit.mockResolvedValue({ success: false });
    const { limitMessages } = await import("../limits");

    await expect(limitMessages("user-3")).rejects.toThrow("Too many messages");
  });
});
