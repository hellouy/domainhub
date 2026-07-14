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
  // 逐 TLD 拉取, 请求量大: 放宽 rpm, 降低重试
  rateLimit: { concurrency: 2, rpm: 120, retries: 1, timeoutMs: 30_000 },
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
        // 后续认证调用：Bearer token + Content-Type（官方客户端一致）
        const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

        try {
          // 2. 确定要取价的后缀清单
          // Netim REST 1.0 无 TLD 列表端点（/tlds 返回 404），改用平台已收录的后缀集合
          // （ctx.knownTlds），逐个查询 /tld/{tld}/ 获取价格。
          const tldList: string[] = Array.from(ctx.knownTlds)
            .map((t) => t.replace(/^\./, "").toLowerCase())
            .filter((t) => /^[a-z0-9.-]{2,}$/.test(t))
          if (tldList.length === 0) throw new Error("Netim: 平台未收录任何后缀(ctx.knownTlds 为空)")
          await ctx.log("info", `Netim: 依据平台后缀集合共 ${tldList.length} 个, 开始逐个取价`)

          // 3. 逐 TLD 拉取价格信息
          const results: Array<{ tld: string; info: Record<string, unknown> }> = []
          let failures = 0
          for (const tld of tldList) {
            try {
              const infoRes = await ctx.fetch(`${API_BASE}/tld/${encodeURIComponent(tld)}/`, { headers: auth })
              if (!infoRes.ok) {
                failures++
                continue
              }
              const info = (await infoRes.json()) as Record<string, unknown>
              results.push({ tld, info })
            } catch {
              failures++
              // 单个 TLD 失败不中断整体
            }
            // 失败过半则提前终止, 避免无效消耗
            if (failures > 50 && failures > results.length) {
              throw new Error(`Netim 逐 TLD 取价失败率过高(${failures} 次失败), 提前终止`)
            }
          }
          if (failures > 0) await ctx.log("warn", `Netim: ${failures} 个后缀取价失败, 已跳过`)
          return JSON.stringify(results)
        } finally {
          // 4. 关闭会话(尽力而为)
          await ctx.fetch(`${API_BASE}/session`, { method: "DELETE", headers: auth }).catch(() => undefined)
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
