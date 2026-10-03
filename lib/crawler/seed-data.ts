// 种子价格数据 —— 真实采集快照 + 品牌占位合并
// ------------------------------------------------------------
// 真实部分来自 data/prices-YYYYMMDD.json 采集明细（scripts/generate-seed-data.ts 生成），
// 覆盖 24 家注册商的全量后缀报价，币种为采集时注册商原币种。
// 占位部分为采集未覆盖的品牌注册商（API 凭证待配置/反爬），价格贴近真实水平的 USD 估值。
// 结构：registrar slug -> tld -> [注册价, 续费价, 转入价]（null 表示该注册商不提供该后缀）
import { SEED_SNAPSHOT } from "./seed-prices"

export type SeedPriceTuple = [number | null, number | null, number | null]

export interface SeedRegistrarMeta {
  name: string
  website: string
  currency: string
  strategy: string | null
}

/** 采集未覆盖的品牌注册商:USD 占位定价（真实快照优先，以下 slug 均不在快照中） */
const CURATED_PRICES: Record<string, Record<string, SeedPriceTuple>> = {
  namecheap: {
    com: [10.28, 16.98, 10.28],
    net: [12.98, 16.98, 12.98],
    org: [9.98, 16.98, 9.98],
    io: [39.98, 59.98, 45.98],
    dev: [12.98, 16.98, 13.98],
    app: [14.98, 18.98, 15.98],
    xyz: [1.98, 13.98, 10.98],
    ai: [69.98, 79.98, 74.98],
    co: [12.98, 29.98, 24.98],
    me: [8.98, 22.98, 16.98],
    top: [1.98, 5.98, 4.98],
    sh: [34.98, 49.98, 44.98],
    cc: [9.98, 12.98, 10.98],
  },
  godaddy: {
    com: [11.99, 21.99, 11.99],
    net: [14.99, 22.99, 14.99],
    org: [12.99, 24.99, 12.99],
    io: [49.99, 79.99, 59.99],
    dev: [17.99, 19.99, 17.99],
    app: [19.99, 21.99, 19.99],
    xyz: [2.99, 15.99, 11.99],
    ai: [89.99, 99.99, 94.99],
    co: [29.99, 34.99, 29.99],
    me: [19.99, 24.99, 19.99],
    cn: [8.99, 9.99, 8.99],
    top: [2.99, 6.99, 5.99],
    sh: [49.99, 59.99, 54.99],
    cc: [12.99, 19.99, 14.99],
  },
  dynadot: {
    com: [11.99, 11.99, 11.99],
    net: [12.99, 12.99, 12.99],
    org: [11.99, 11.99, 11.99],
    io: [46.99, 46.99, 46.99],
    dev: [12.99, 14.99, 13.99],
    app: [15.99, 16.99, 15.99],
    xyz: [1.99, 12.99, 10.99],
    ai: [74.99, 74.99, 74.99],
    co: [27.99, 27.99, 27.99],
    me: [18.99, 18.99, 18.99],
    cn: [7.99, 8.99, 7.99],
    top: [2.99, 5.99, 4.99],
    sh: [42.99, 42.99, 42.99],
    cc: [9.99, 9.99, 9.99],
  },
  spaceship: {
    com: [8.98, 10.98, 9.48],
    net: [11.48, 13.48, 11.98],
    org: [9.98, 12.48, 10.48],
    io: [38.98, 54.98, 44.98],
    dev: [11.98, 13.98, 12.48],
    app: [13.48, 15.98, 14.48],
    xyz: [1.98, 11.98, 9.98],
    ai: [68.98, 78.98, 72.98],
    co: [24.98, 28.98, 25.98],
    me: [16.98, 19.98, 17.48],
    top: [1.98, 4.98, 3.98],
    sh: [36.98, 48.98, 42.98],
    cc: [8.48, 11.98, 9.48],
  },
  aliyun: {
    com: [10.5, 12.5, 10.5],
    net: [12.0, 14.0, 12.0],
    org: [11.0, 13.0, 11.0],
    xyz: [1.5, 12.0, 9.5],
    co: [25.0, 30.0, 25.0],
    me: [18.0, 20.0, 18.0],
    cn: [4.5, 5.5, 4.5],
    top: [1.3, 3.5, 3.0],
    cc: [6.0, 9.0, 7.0],
  },
}

const CURATED_META: Record<string, SeedRegistrarMeta> = {
  namecheap: { name: "Namecheap", website: "https://www.namecheap.com", currency: "USD", strategy: null },
  godaddy: { name: "GoDaddy", website: "https://www.godaddy.com", currency: "USD", strategy: null },
  dynadot: { name: "Dynadot", website: "https://www.dynadot.com", currency: "USD", strategy: null },
  spaceship: { name: "Spaceship", website: "https://www.spaceship.com", currency: "USD", strategy: null },
  aliyun: { name: "阿里云万网", website: "https://wanwang.aliyun.com", currency: "USD", strategy: null },
}

/** 合并后的全量价格表:真实采集快照 + 品牌占位 */
export const SEED_PRICES: Record<string, Record<string, SeedPriceTuple>> = { ...CURATED_PRICES }
for (const [slug, r] of Object.entries(SEED_SNAPSHOT.registrars)) {
  SEED_PRICES[slug] = r.prices
}

/** 合并后的注册商元信息(名称/官网/计价币种) */
export const SEED_REGISTRAR_META: Record<string, SeedRegistrarMeta> = { ...CURATED_META }
for (const [slug, r] of Object.entries(SEED_SNAPSHOT.registrars)) {
  SEED_REGISTRAR_META[slug] = { name: r.name, website: r.website, currency: r.currency, strategy: r.strategy }
}

/** 采集来源页面（用于 source_url 展示） */
export const SEED_SOURCE_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(SEED_REGISTRAR_META).map(([slug, m]) => [slug, m.website]),
)

/** 快照采集时间（兜底数据展示「最后更新」用） */
export const SEED_COLLECTED_AT: string = SEED_SNAPSHOT.collectedAt
