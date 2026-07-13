import { describe, expect, it, vi } from "vitest"
import { CacheService } from "@/services/cache"

describe("CacheService", () => {
  it("命中缓存时不重复执行 loader", async () => {
    const cache = new CacheService()
    const loader = vi.fn().mockResolvedValue("value")
    await cache.getOrSet("k", 1000, loader)
    await cache.getOrSet("k", 1000, loader)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("过期后重新加载", async () => {
    const cache = new CacheService()
    const loader = vi.fn().mockResolvedValue("value")
    await cache.getOrSet("k", -1, loader) // 立即过期
    await cache.getOrSet("k", 1000, loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it("按标签批量失效", async () => {
    const cache = new CacheService()
    const loader = vi.fn().mockResolvedValue(1)
    await cache.getOrSet("a", 60_000, loader, ["prices"])
    await cache.getOrSet("b", 60_000, loader, ["prices"])
    await cache.getOrSet("c", 60_000, loader, ["other"])
    const removed = cache.invalidateTag("prices")
    expect(removed).toBe(2)
    await cache.getOrSet("a", 60_000, loader, ["prices"]) // 重新加载
    await cache.getOrSet("c", 60_000, loader, ["other"]) // 仍命中
    expect(loader).toHaveBeenCalledTimes(4)
  })

  it("并发同 key 请求共享同一个 loader（防穿透）", async () => {
    const cache = new CacheService()
    let resolveLoader: (v: string) => void = () => {}
    const loader = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoader = resolve
        }),
    )
    const p1 = cache.getOrSet("k", 1000, loader)
    const p2 = cache.getOrSet("k", 1000, loader)
    resolveLoader("done")
    expect(await p1).toBe("done")
    expect(await p2).toBe("done")
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("统计命中率", async () => {
    const cache = new CacheService()
    const loader = vi.fn().mockResolvedValue(1)
    await cache.getOrSet("k", 1000, loader) // miss
    await cache.getOrSet("k", 1000, loader) // hit
    const stats = cache.stats()
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(1)
    expect(stats.hitRatio).toBe(50)
  })
})
