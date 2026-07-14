/**
 * Netim 适配器(Adapter SDK 2.0)— 代理商 REST API,等凭证即用
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 数据源结论(2026-07, 已用真实代理商凭证实测):
 * 1. private-api: Netim 代理商 REST API(rest.netim.com/1.0)。
 *    流程: POST /session(Basic 认证 + Content-Type + Accept-Language, 无 body)
 *      → 获得 Bearer token
 *      → 依据平台已收录后缀集合(ctx.knownTlds) 逐个 GET /tld/{ext}/ 取价
 *      → DELETE /session 关闭。
 *    注意: REST 1.0 没有 TLD 列表端点(/tlds 返回 404), 因此后缀清单来自平台侧。
 *    价格字段: Fee4Registration / Fee4Renewal / Fee4Transfer / Fee4Restore / FeeCurrency。
 *    凭证录入(/admin/credentials): type=basic,
 *      values.username=<代理商登录 ID>, values.password=<API 密钥/secret>
 *    前提: Netim 后台需先启用 API 访问(Reseller area → API 设置);
 *    测试环境改用 OTE 基址(见 API_BASE 注释)。
 * 2. html: netim.com 价格页为 JS 动态渲染, 静态抓取不可用。
 */

import { defineAdapter, type RawPrice } from "@/packages/adapter-sdk"

// 生产环境; OTE 测试环境为 https://oterest.netim.com/1.0
const API_BASE = "https://rest.netim.com/1.0"

/** 从对象中按候选键取第一个存在的值(容忍 API 字段大小写差异) */
function pick(obj: Record<string, unknown>, candidates: string[]): unknown {
  for (const key of candidates) {
    if (key in obj && obj[key] !== undefined && obj[key] !== null) return obj[key]
    const lower = key.toLowerCase()
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase() === lower && obj[k] !== undefined && obj[k] !== null) return obj[k]
    }
  }
  return null
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

export const netimAdapter = defineAdapter({
  slug: "netim",
  name: "Netim",
  website: "https://www.netim.com",
  owner: "Data Team",
  version: "2.0.0",
  parserVersion: "1.0.0",
  currency: "EUR",
  priority: 40,
  capabilities: {
    registration: true,
    renewal: true,
    transfer: true,
    restore: true,
    dnssec: true,
    whoisPrivacy: true,
    api: true,
    supportedCurrencies: ["EUR"],
    supportedLanguages: ["en", "fr"],
  },
  // 逐 TLD 拉取, 请求量大。分批(每批 50)后单次压力可控:
  //   - 串行(concurrency 1)+ 适中 rpm, 避免 Netim 连接丢弃
  //   - retries 3 + 指数退避, 吸收瞬时网络抖动(上次熔断的主因)
  //   - 熔断阈值放宽, 冷却缩短
  rateLimit: {
    concurrency: 1,
    rpm: 90,
    retries: 3,
    backoffMs: 1_000,
    timeoutMs: 30_000,
    circuitBreakerThreshold: 15,
    circuitBreakerCooldownMs: 60_000,
  },
  hooks: {
    async initialize(ctx) {
      const cred = await ctx.getCredential("basic")
      if (!cred?.values.username || !cred?.values.password) {
        throw new Error(
          "Netim 缺少代理商凭证。请在 /admin/credentials 为 netim 录入 type=basic 凭证(username=代理商 ID, password=API 密钥)",
        )
      }
    },
  },
  strategies: [
    {
      type: "private-api",
      url: API_BASE,
      async fetch(ctx) {
        const cred = await ctx.getCredential("basic")
        const basic = Buffer.from(
          `${cred?.values.username ?? ""}:${cred?.values.password ?? ""}`,
        ).toString("base64")

        // 1. 开启会话
        // Netim REST 1.0 契约（对齐官方客户端 netim-apirest-client）：
        //   POST /session，Basic 认证，必须带 Content-Type: application/json，
        //   语言通过 Accept-Language 头传递（缺失会 406；带 body 反而 400）。
        const sessRes = await ctx.fetch(`${API_BASE}/session`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/json",
            "Accept-Language": "EN",
          },
        })
        if (!sessRes.ok) {
          throw new Error(`Netim 会话创建失败 HTTP ${sessRes.status}(检查代理商 ID/密钥与 API 是否已启用)`)
        }
        const sess = (await sessRes.json()) as Record<string, unknown>
        const token = String(pick(sess, ["access_token", "IDSession", "sessionId", "token"]) ?? "")
        if (!token) throw new Error(`Netim 会话响应中未找到 token: ${JSON.stringify(sess).slice(0, 200)}`)

        // 后续认证调用：Bearer token + Content-Type（官方客户端一致）。
        // 会话 token 可变（401/失效时自动续期），故用可变引用 + authHeaders() 取值。
        let sessionToken = token
        const authHeaders = () => ({
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        })
        // 重开会话：token 过期时调用
        const reopenSession = async (): Promise<boolean> => {
          const r = await ctx.fetch(`${API_BASE}/session`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${basic}`,
              "Content-Type": "application/json",
              "Accept-Language": "EN",
            },
          })
          if (!r.ok) return false
          const j = (await r.json()) as Record<string, unknown>
          const t = String(pick(j, ["access_token", "IDSession", "sessionId", "token"]) ?? "")
          if (!t) return false
          sessionToken = t
          await ctx.log("info", "Netim: 会话已过期, 自动续期成功")
          return true
        }

        try {
          // 2. 确定要取价的后缀清单
          // Netim REST 1.0 无 TLD 列表端点（/tlds 返回 404），改用平台已收录的后缀集合。
          // 取价范围（由平台经 ctx.crawlScope 注入，适配器不感知业务策略）：
          //   - crawlScope.tlds: 显式后缀白名单（分批回填时每批 50 个走这里）
          //   - crawlScope.topN: 只取热度前 N（日常默认 Top 300）
          //   - 都未提供: 回退默认 Top 300（避免误触发全量轰炸）
          const DEFAULT_TOP_N = 300
          const ranked = (ctx.knownTldsRanked && ctx.knownTldsRanked.length > 0
            ? ctx.knownTldsRanked
            : Array.from(ctx.knownTlds)
          )
            .map((t) => t.replace(/^\./, "").toLowerCase())
            .filter((t) => /^[a-z0-9.-]{2,}$/.test(t))

          let tldList: string[]
          if (ctx.crawlScope?.tlds && ctx.crawlScope.tlds.length > 0) {
            const allow = new Set(
              ctx.crawlScope.tlds.map((t) => t.replace(/^\./, "").toLowerCase()),
            )
            tldList = ranked.filter((t) => allow.has(t))
            // 白名单里可能有 ranked 未覆盖的后缀，补齐
            for (const t of allow) if (!tldList.includes(t)) tldList.push(t)
          } else {
            const topN = ctx.crawlScope?.topN ?? DEFAULT_TOP_N
            tldList = ranked.slice(0, topN)
          }
          if (tldList.length === 0) throw new Error("Netim: 目标后缀集合为空(检查 ctx.knownTlds/crawlScope)")
          await ctx.log("info", `Netim: 目标后缀 ${tldList.length} 个, 开始逐个取价`)

          // 3. 逐 TLD 拉取价格信息
          // 失败分类：404=Netim 不经营该后缀(正常跳过, 不计熔断)；
          //           401=会话过期(续期后重试一次)；其它/网络错误=瞬时失败(计数)。
          const results: Array<{ tld: string; info: Record<string, unknown> }> = []
          let notOffered = 0 // 404
          let hardFailures = 0 // 真实失败
          for (const tld of tldList) {
            let attempted401Retry = false
            for (;;) {
              try {
                const infoRes = await ctx.fetch(`${API_BASE}/tld/${encodeURIComponent(tld)}/`, {
                  headers: authHeaders(),
                })
                if (infoRes.ok) {
                  const info = (await infoRes.json()) as Record<string, unknown>
                  results.push({ tld, info })
                  break
                }
                if (infoRes.status === 404) {
                  notOffered++
                  break
                }
                if ((infoRes.status === 401 || infoRes.status === 403) && !attempted401Retry) {
                  attempted401Retry = true
                  if (await reopenSession()) continue // 续期后重试该后缀
                }
                hardFailures++
                break
              } catch {
                // 网络级错误（连接被丢弃等）：计一次硬失败，交由平台限流层已做的退避
                hardFailures++
                break
              }
            }
            // 熔断：真实失败过多才中止（404 不计），阈值放宽
            if (hardFailures > 80 && hardFailures > results.length) {
              throw new Error(`Netim 取价硬失败过多(${hardFailures} 次), 提前终止本批`)
            }
          }
          await ctx.log(
            "info",
            `Netim: 成功 ${results.length}, 不经营(404) ${notOffered}, 失败 ${hardFailures}`,
          )
          return JSON.stringify(results)
        } finally {
          // 4. 关闭会话(尽力而为)
          await ctx.fetch(`${API_BASE}/session`, { method: "DELETE", headers: authHeaders() }).catch(
            () => undefined,
          )
        }
      },
      async parse(raw): Promise<RawPrice[]> {
        const rows = JSON.parse(raw) as Array<{ tld: string; info: Record<string, unknown> }>
        const prices: RawPrice[] = []
        for (const { tld, info } of rows) {
          // 兼容多种字段命名(创建/注册, 续费, 转入, 赎回)
          const register = toNum(pick(info, ["Fee4Registration", "feeCreate", "createPrice", "registration", "create"]))
          const renew = toNum(pick(info, ["Fee4Renewal", "feeRenew", "renewPrice", "renewal", "renew"]))
          const transfer = toNum(pick(info, ["Fee4Transfer", "feeTransfer", "transferPrice", "transfer"]))
          const restore = toNum(pick(info, ["Fee4Restore", "feeRestore", "restorePrice", "restore"]))
          const currency = String(pick(info, ["FeeCurrency", "currency", "Currency"]) ?? "EUR").toUpperCase()
          if (register === null && renew === null && transfer === null) continue
          prices.push({
            tld,
            registerPrice: register,
            renewPrice: renew,
            transferPrice: transfer,
            restorePrice: restore,
            currency,
            sourceUrl: "https://rest.netim.com",
          })
        }
        if (prices.length === 0) throw new Error("Netim API 未解析出任何定价(检查 parse 候选键与实际响应)")
        return prices
      },
    },
  ],
})
