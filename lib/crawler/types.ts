/**
 * 采集 Adapter 架构类型定义
 *
 * 每个注册商对应一个 Adapter，实现统一的 fetchPrices 接口。
 * Runner 负责调度 Adapter、写入价格与历史记录、记录任务日志。
 */

export interface CrawledPrice {
  /** 后缀，不含点，如 "com" */
  tld: string
  registerPrice: number | null
  renewPrice: number | null
  transferPrice: number | null
  currency: string
  sourceUrl?: string
}

export interface CrawlContext {
  /** 记录一条采集日志（写入 crawl_logs） */
  log: (level: 'info' | 'warn' | 'error', message: string) => Promise<void>
}

export interface RegistrarAdapter {
  /** 对应 registrars.slug */
  slug: string
  /** 展示名称 */
  name: string
  /** 采集方式说明（后台展示用） */
  strategy: string
  /** 拉取该注册商的全部后缀价格 */
  fetchPrices: (ctx: CrawlContext) => Promise<CrawledPrice[]>
}
