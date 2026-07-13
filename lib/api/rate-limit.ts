import "server-only"

/**
 * 进程内滑动窗口限流器（Sprint 4 Part 9）
 *
 * 默认策略：每 IP 每分钟 120 次请求（公开 API），管理 API 每分钟 30 次。
 * Serverless 多实例下各实例独立计数，作为第一道防线足够；
 * 未来接入 Upstash Redis 时替换本文件即可。
 */

interface Bucket {
  count: number
  resetAt: number
}

const WINDOW_MS = 60_000

export class RateLimiter {
  private buckets = new Map<string, Bucket>()

  constructor(private readonly limit: number) {}

  /**
   * 检查并计数。返回是否允许，以及剩余额度与重置时间。
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    let bucket = this.buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + WINDOW_MS }
      this.buckets.set(key, bucket)
      // 顺手清理过期桶，防止内存膨胀
      if (this.buckets.size > 10_000) {
        for (const [k, b] of this.buckets) {
          if (b.resetAt <= now) this.buckets.delete(k)
        }
      }
    }
    bucket.count++
    return {
      allowed: bucket.count <= this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      resetAt: bucket.resetAt,
    }
  }
}

const globalStore = globalThis as unknown as {
  __domainhubPublicLimiter?: RateLimiter
  __domainhubAdminLimiter?: RateLimiter
}

/** 公开 API：120 req/min/IP */
export const publicRateLimiter = (globalStore.__domainhubPublicLimiter ??= new RateLimiter(120))
/** 管理 API：30 req/min/IP */
export const adminRateLimiter = (globalStore.__domainhubAdminLimiter ??= new RateLimiter(30))

/** 从请求中提取客户端 IP */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return request.headers.get("x-real-ip") ?? "unknown"
}
