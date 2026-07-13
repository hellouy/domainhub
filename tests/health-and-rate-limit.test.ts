import { describe, expect, it } from "vitest"
import { computeHealthScore } from "@/services/coverage/health-score"
import { RateLimiter } from "@/lib/api/rate-limit"

describe("computeHealthScore", () => {
  it("满分场景：成功 + 全覆盖 + 新鲜 + 完整", () => {
    const score = computeHealthScore({
      coveragePct: 100,
      lastCrawlStatus: "success",
      lastCrawlAt: new Date(),
      missingRatio: 0,
    })
    expect(score).toBe(100)
  })

  it("从未采集的注册商得分很低", () => {
    const score = computeHealthScore({
      coveragePct: 0,
      lastCrawlStatus: null,
      lastCrawlAt: null,
      missingRatio: 1,
    })
    expect(score).toBe(0)
  })

  it("warning 状态得分低于 success", () => {
    const base = { coveragePct: 50, lastCrawlAt: new Date(), missingRatio: 0 }
    const success = computeHealthScore({ ...base, lastCrawlStatus: "success" })
    const warning = computeHealthScore({ ...base, lastCrawlStatus: "warning" })
    expect(success - warning).toBe(15)
  })

  it("数据越旧新鲜度分越低", () => {
    const base = { coveragePct: 100, lastCrawlStatus: "success", missingRatio: 0 }
    const fresh = computeHealthScore({ ...base, lastCrawlAt: new Date() })
    const stale = computeHealthScore({ ...base, lastCrawlAt: new Date(Date.now() - 48 * 3600_000) })
    const ancient = computeHealthScore({ ...base, lastCrawlAt: new Date(Date.now() - 100 * 3600_000) })
    expect(fresh).toBeGreaterThan(stale)
    expect(stale).toBeGreaterThan(ancient)
  })
})

describe("RateLimiter", () => {
  it("限额内允许请求并递减剩余额度", () => {
    const limiter = new RateLimiter(3)
    expect(limiter.check("ip1").allowed).toBe(true)
    expect(limiter.check("ip1").remaining).toBe(1)
    expect(limiter.check("ip1").allowed).toBe(true)
  })

  it("超限后拒绝请求", () => {
    const limiter = new RateLimiter(2)
    limiter.check("ip1")
    limiter.check("ip1")
    expect(limiter.check("ip1").allowed).toBe(false)
  })

  it("不同 key 独立计数", () => {
    const limiter = new RateLimiter(1)
    expect(limiter.check("a").allowed).toBe(true)
    expect(limiter.check("b").allowed).toBe(true)
    expect(limiter.check("a").allowed).toBe(false)
  })
})
