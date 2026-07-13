import "server-only"

/**
 * Cache 服务：进程内 TTL 缓存 + 标签失效
 *
 * 设计目标（Sprint 4 Part 4）：
 * - 全站唯一缓存入口，任何模块不得自行实现缓存逻辑
 * - `getOrSet(key, ttl, loader, tags)` 一个方法覆盖所有场景（首页/热门后缀/统计/覆盖率/API 响应）
 * - 标签失效：采集成功后调用 `invalidateTag("prices")` 精确清除所有价格相关缓存
 * - TTL 可按条目配置；命中/未命中计数供 Metrics 服务读取
 *
 * 说明：Serverless 场景下每个实例的缓存彼此独立，这是有意为之的轻量方案；
 * 未来接入 Redis 时只需替换本文件的实现，调用方零改动。
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
  tags: string[]
}

/** 常用 TTL（毫秒） */
export const TTL = {
  /** 高频页面数据：首页、热门后缀 */
  page: 5 * 60 * 1000,
  /** 统计与聚合：统计 API、覆盖率、情报 */
  stats: 10 * 60 * 1000,
  /** 公开 API 响应 */
  api: 60 * 1000,
  /** 短缓存：监控面板 */
  short: 30 * 1000,
} as const

/** 标签常量：invalidateTag 与 getOrSet 双方共用，避免拼写漂移 */
export const CACHE_TAGS = {
  prices: "prices",
  registrars: "registrars",
  statistics: "statistics",
  coverage: "coverage",
} as const

export class CacheService {
  private store = new Map<string, CacheEntry<unknown>>()
  private hits = 0
  private misses = 0
  /** 防止同 key 并发穿透：进行中的 loader 共享同一个 Promise */
  private inflight = new Map<string, Promise<unknown>>()

  /**
   * 读取缓存；未命中或过期时执行 loader 并写入。
   * @param key  缓存键（约定格式 "scope:detail"，如 "api:prices:com"）
   * @param ttlMs 存活时间（毫秒），建议使用 TTL 常量
   * @param loader 未命中时的加载函数
   * @param tags 关联标签（invalidateTag 时批量清除）
   */
  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>, tags: string[] = []): Promise<T> {
    const entry = this.store.get(key)
    if (entry && entry.expiresAt > Date.now()) {
      this.hits++
      return entry.value as T
    }
    this.misses++

    const pending = this.inflight.get(key)
    if (pending) return pending as Promise<T>

    const promise = loader()
      .then((value) => {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs, tags })
        return value
      })
      .finally(() => {
        this.inflight.delete(key)
      })
    this.inflight.set(key, promise)
    return promise
  }

  /** 精确删除一个键 */
  delete(key: string): void {
    this.store.delete(key)
  }

  /** 按标签批量失效（采集成功后调用） */
  invalidateTag(tag: string): number {
    let removed = 0
    for (const [key, entry] of this.store) {
      if (entry.tags.includes(tag)) {
        this.store.delete(key)
        removed++
      }
    }
    return removed
  }

  /** 清空全部缓存 */
  clear(): void {
    this.store.clear()
  }

  /** 命中率统计（Metrics / 监控面板使用） */
  stats() {
    const total = this.hits + this.misses
    return {
      entries: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? Math.round((this.hits / total) * 100) : 0,
    }
  }
}

/** 全局单例（跨请求复用；测试可自行 new CacheService()） */
const globalStore = globalThis as unknown as { __domainhubCache?: CacheService }
export const cacheService = (globalStore.__domainhubCache ??= new CacheService())
