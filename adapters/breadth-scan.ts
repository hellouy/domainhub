/**
 * 广度扫描接入的注册商（各大洲中小型注册商，干净 SSR 表格 / 公开 JSON）
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 策略说明：优先挑「无登录、无 Cloudflare、表结构稳定」的公开价格源，
 * 避免死磕头部大厂的反爬。已接入：
 * - ukrnames（乌克兰） : 静态 <table>，register/renew/transfer/restore
 * - idwebhost（印尼）  : <option value="tld" data-hs-select-option='{desc 含价格}'>，register
 * - keliweb（意大利）  : <li data-val=".tld" data-p="X"><del>€ Y</del> € Z</li>，register/promo-renew
 */
import { createTableAdapter } from "./shared/table-adapter"
import { defineAdapter, type AdapterContext, type RawPrice } from "@/packages/adapter-sdk"

// ── 乌克兰 UKRNAMES ─────────────────────────────────────────────────
// 表头: Доменна зона | Реєстрація | Продовження | Трансфер | Відновлення
export const ukrnamesAdapter = createTableAdapter({
  slug: "ukrnames",
  name: "UKRNAMES",
  website: "https://www.ukrnames.com",
  currency: "UAH",
  urls: ["https://www.ukrnames.com/ukr/domain/prices/"],
  columnOrder: ["register", "renew", "transfer", "restore"],
})

// ── 印尼 IDWebhost（自定义解析：option 标签内嵌 JSON）──────────────
async function parseIdwebhost(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  const re = /<option\s+value="([^"]+)"[^>]*data-hs-select-option='(\{[^']*?\})'\s*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const tld = m[1].trim().toLowerCase().replace(/^\./, "")
    if (!tld || seen.has(tld)) continue
    let num: number | null = null
    try {
      const desc = (JSON.parse(m[2]) as { description?: string }).description ?? ""
      const mm = desc.match(/Rp\.?\s*([\d.,]+)/i)
      if (mm) num = Number(mm[1].replace(/\./g, "").replace(/,/g, ""))
    } catch {
      /* 跳过无法解析的 option */
    }
    if (num == null || !Number.isFinite(num) || num <= 0) continue
    seen.add(tld)
    out.push({ tld, currency: "IDR", registerPrice: num, sourceUrl: "https://www.idwebhost.com/domain-murah" })
  }
  if (out.length === 0) throw new Error("idwebhost option 解析结果为空（页面结构可能已变化）")
  return out
}

export const idwebhostAdapter = defineAdapter({
  slug: "idwebhost",
  name: "IDWEBHOST",
  website: "https://www.idwebhost.com",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "IDR",
  capabilities: { registration: true, renewal: false, transfer: false, supportedCurrencies: ["IDR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: "https://www.idwebhost.com/domain-murah",
      parse: parseIdwebhost,
    },
  ],
})

// ── 意大利 Keliweb（自定义解析：li 携带 data-val/del 价）──────────
function num(s: string): number | null {
  const t = s.replace(/[^\d.,]/g, "")
  const v = Number.parseFloat(t.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
}

async function parseKeliweb(raw: string, _ctx: AdapterContext): Promise<RawPrice[]> {
  const out: RawPrice[] = []
  const seen = new Set<string>()
  // 每条: <li class="item ..." data-val=".it" data-p="15.90"> <div class="right"><del>€ 15.90</del> € 12.72</div> ...
  // 语义（已验证 2026-09-28 source）:
  //   - <del>€ X</del> € Y   => X=原价/年续费价, Y=当前促销价(注册首年/当前实付)
  //   - € Z（无 del）         => 无促销, 注册=续费=Z
  const re = /<li[^>]*data-val="(\.?[a-z0-9_.-]+)"[^>]*data-p="([0-9.,]+)"[^>]*>[\s\S]*?<\/li>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const tld = m[1].trim().toLowerCase().replace(/^\./, "")
    if (!tld || seen.has(tld)) continue
    const block = m[0]
    const dels = [...block.matchAll(/<del[^>]*>([\s\S]*?)<\/del>/gi)].map((x) => num(x[1]))
    // <del> 存在 => 促销：del=年续费价；非 del 的当前价=注册价
    // 无 <del> => 单一价，注册=续费
    let registerPrice: number | null
    let renewPrice: number | null
    if (dels.length > 0) {
      renewPrice = dels[dels.length - 1]
      // 取 <del> 之后紧邻的当前价（促销实付价）
      const after = block
        .split("</del>")
        .slice(1)
        .join("</del>")
      const cur = num((after.match(/€\s*([\d.,]+)/) ?? [])[1] ?? "")
      registerPrice = cur
    } else {
      const annual = num(m[2])
      registerPrice = annual
      renewPrice = annual
    }
    if (registerPrice == null && renewPrice == null) continue
    seen.add(tld)
    out.push({ tld, currency: "EUR", registerPrice, renewPrice, sourceUrl: "https://www.keliweb.it/domini/" })
  }
  if (out.length === 0) throw new Error("keliweb li 解析结果为空（页面结构可能已变化）")
  return out
}

export const keliwebAdapter = defineAdapter({
  slug: "keliweb",
  name: "Keliweb",
  website: "https://www.keliweb.it",
  owner: "Data Team",
  version: "1.0.0",
  parserVersion: "1.0.0",
  currency: "EUR",
  capabilities: { registration: true, renewal: true, transfer: false, supportedCurrencies: ["EUR"] },
  rateLimit: { concurrency: 1, rpm: 10, retries: 2, timeoutMs: 60_000 },
  strategies: [
    {
      type: "html",
      url: "https://www.keliweb.it/domini/",
      parse: parseKeliweb,
    },
  ],
})