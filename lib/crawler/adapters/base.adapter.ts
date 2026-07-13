import type { CrawlContext, DomainPrice, RawContent, RegistrarAdapter } from "../types"
import { parserService, type ParseOptions, type ParserService, type RawRecord } from "@/services/parser"

/**
 * BaseAdapter —— 所有注册商 Adapter 的基类
 *
 * 生命周期（由 Runner 按序驱动，save/finish 中的落库由 Storage 服务执行）：
 *
 *   initialize()  准备工作（校验配置、构造请求参数），默认空实现
 *   fetch()       抓取原始内容，返回 RawContent（json/html/xml），必须实现
 *   parse()       RawContent -> RawRecord[]，默认委托 Parser 服务，禁止在子类写解析逻辑
 *   normalize()   RawRecord[] -> DomainPrice[]，字段映射，必须实现
 *   save()        由 Runner 调用 Storage 完成（Adapter 不直接碰数据库）
 *   finish()      清理工作（释放连接、汇总日志），默认空实现
 *
 * 新增注册商只需：继承本类，实现 fetch() 与 normalize()，然后在
 * adapters/index.ts 注册一行。除此之外不需要改动任何代码。
 */
export abstract class BaseAdapter implements RegistrarAdapter {
  /** 对应 registrars.slug */
  abstract readonly slug: string
  /** 展示名称 */
  abstract readonly name: string
  /** 采集方式说明（后台展示用） */
  abstract readonly strategy: string

  /** Parser 通过构造函数注入，测试时可传入替身 */
  constructor(protected readonly parser: ParserService = parserService) {}

  /** 网络请求默认配置（子类可覆盖） */
  protected readonly fetchTimeoutMs: number = 60_000
  protected readonly fetchRetries: number = 3

  // ---------- 生命周期钩子 ----------

  /** 1. 准备工作，默认空实现 */
  protected async initialize(_ctx: CrawlContext): Promise<void> {}

  /** 2. 抓取原始内容，必须实现 */
  protected abstract fetch(ctx: CrawlContext): Promise<RawContent>

  /** 3. 解析：默认委托 Parser 服务；子类只能调整 ParseOptions，不允许自写解析逻辑 */
  protected parse(raw: RawContent, _ctx: CrawlContext): RawRecord[] {
    return this.parser.parse(raw, this.parseOptions())
  }

  /** Parser 参数（HTML 表格序号 / XML 记录标签等） */
  protected parseOptions(): ParseOptions {
    return {}
  }

  /** 4. 归一化：原始记录 -> DomainPrice，必须实现 */
  protected abstract normalize(records: RawRecord[], ctx: CrawlContext): DomainPrice[]

  /** 6. 清理工作，默认空实现（5. save 由 Runner + Storage 执行） */
  protected async finish(_ctx: CrawlContext): Promise<void> {}

  // ---------- 模板方法 ----------

  /** Runner 的统一入口：串联 initialize -> fetch -> parse -> normalize -> finish */
  async collect(ctx: CrawlContext): Promise<DomainPrice[]> {
    await this.initialize(ctx)
    try {
      if (ctx.isCancelled()) throw new Error("任务已取消")
      const raw = await this.fetch(ctx)
      if (ctx.isCancelled()) throw new Error("任务已取消")
      const records = this.parse(raw, ctx)
      await ctx.log("info", `解析完成：${records.length} 条原始记录（${raw.kind}）`)
      const normalized = this.normalize(records, ctx)
      if (normalized.length === 0) {
        throw new Error("归一化后没有任何有效价格，放弃写入以保护现有数据")
      }
      await ctx.log("info", `归一化完成：${normalized.length} 条有效价格`)
      return normalized
    } finally {
      await this.finish(ctx)
    }
  }

  // ---------- 子类共用工具 ----------

  /** 带超时与重试（指数退避）的 HTTP 请求，返回响应文本 */
  protected async httpGet(url: string, ctx: CrawlContext, accept = "application/json"): Promise<string> {
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= this.fetchRetries; attempt++) {
      if (ctx.isCancelled()) throw new Error("任务已取消")
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs)
      try {
        await ctx.log("info", `请求数据源（第 ${attempt}/${this.fetchRetries} 次）：${url}`)
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "DomainHub/1.0 (price aggregator)",
            Accept: accept,
          },
          cache: "no-store",
        })
        if (!res.ok) throw new Error(`数据源返回 HTTP ${res.status}`)
        return await res.text()
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const isAbort = lastError.name === "AbortError"
        await ctx.log(
          "warn",
          `第 ${attempt} 次请求失败：${isAbort ? `超时（${this.fetchTimeoutMs / 1000}s）` : lastError.message}`,
        )
        if (attempt < this.fetchRetries) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
        }
      } finally {
        clearTimeout(timer)
      }
    }
    throw new Error(`数据源在 ${this.fetchRetries} 次重试后仍不可用：${lastError?.message ?? "未知错误"}`)
  }

  /** 归一化工具：非法/非正数价格 -> null */
  protected toPrice(v: unknown): number | null {
    const n = typeof v === "string" ? Number.parseFloat(v.replace(/[^0-9.]/g, "")) : v
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
  }

  /** 归一化工具：清理 tld 字符串（去点、小写） */
  protected toTld(v: unknown): string {
    return String(v ?? "").toLowerCase().replace(/^\./, "").trim()
  }
}
