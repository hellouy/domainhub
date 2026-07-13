/**
 * 注册商健康分（0-100，纯函数便于测试）
 *
 * 权重：
 * - 最近任务状态 40 分（success 40 / warning 25 / 其他 0）
 * - 覆盖率 30 分（线性）
 * - 数据新鲜度 20 分（24h 内 20 / 72h 内 10 / 更旧 0）
 * - 数据完整度 10 分（缺失注册价比例越低越高）
 */
export function computeHealthScore(input: {
  coveragePct: number
  lastCrawlStatus: string | null
  lastCrawlAt: Date | null
  /** 缺失注册价的比例 0-1 */
  missingRatio: number
}): number {
  let score = 0

  if (input.lastCrawlStatus === "success") score += 40
  else if (input.lastCrawlStatus === "warning") score += 25

  score += Math.round(Math.min(100, Math.max(0, input.coveragePct)) * 0.3)

  if (input.lastCrawlAt) {
    const ageHours = (Date.now() - input.lastCrawlAt.getTime()) / 3600_000
    if (ageHours <= 24) score += 20
    else if (ageHours <= 72) score += 10
  }

  score += Math.round((1 - Math.min(1, Math.max(0, input.missingRatio))) * 10)

  return Math.min(100, score)
}
