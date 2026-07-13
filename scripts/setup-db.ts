// 数据库初始化脚本：创建全部表结构，并写入注册商与域名后缀基础数据。
// 运行方式：source 环境变量后执行 `npx tsx scripts/setup-db.ts`
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const DDL = `
CREATE TABLE IF NOT EXISTS registrars (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  website text NOT NULL,
  description text NOT NULL DEFAULT '',
  icann_accredited boolean NOT NULL DEFAULT false,
  whois_privacy boolean NOT NULL DEFAULT false,
  dnssec boolean NOT NULL DEFAULT false,
  payment_methods text[] NOT NULL DEFAULT '{}',
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tlds (
  id serial PRIMARY KEY,
  tld text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'gTLD',
  description text NOT NULL DEFAULT '',
  is_popular boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prices (
  id serial PRIMARY KEY,
  registrar_id integer NOT NULL,
  tld_id integer NOT NULL,
  register_price numeric(10,2),
  renew_price numeric(10,2),
  transfer_price numeric(10,2),
  currency text NOT NULL DEFAULT 'USD',
  source_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registrar_id, tld_id)
);

CREATE TABLE IF NOT EXISTS price_history (
  id serial PRIMARY KEY,
  registrar_id integer NOT NULL,
  tld_id integer NOT NULL,
  register_price numeric(10,2),
  renew_price numeric(10,2),
  transfer_price numeric(10,2),
  currency text NOT NULL DEFAULT 'USD',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crawl_jobs (
  id serial PRIMARY KEY,
  registrar_id integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  trigger text NOT NULL DEFAULT 'manual',
  started_at timestamptz,
  finished_at timestamptz,
  prices_updated integer NOT NULL DEFAULT 0,
  total_tlds integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crawl_logs (
  id serial PRIMARY KEY,
  job_id integer NOT NULL,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prices_tld ON prices (tld_id);
CREATE INDEX IF NOT EXISTS idx_prices_registrar ON prices (registrar_id);
CREATE INDEX IF NOT EXISTS idx_price_history_pair ON price_history (registrar_id, tld_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_job ON crawl_logs (job_id);
`

// slug, 名称, 官网, 简介, ICANN 认证, 免费 WHOIS 隐私, DNSSEC, 支付方式
const REGISTRARS: Array<
  [string, string, string, string, boolean, boolean, boolean, string[]]
> = [
  [
    "cloudflare",
    "Cloudflare",
    "https://www.cloudflare.com/products/registrar/",
    "以成本价销售域名，无加价，免费 WHOIS 隐私保护与 DNSSEC。",
    true,
    true,
    true,
    ["信用卡", "PayPal"],
  ],
  [
    "porkbun",
    "Porkbun",
    "https://porkbun.com",
    "价格透明的独立注册商，赠送 WHOIS 隐私与 SSL 证书。",
    true,
    true,
    true,
    ["信用卡", "PayPal"],
  ],
  [
    "namecheap",
    "Namecheap",
    "https://www.namecheap.com",
    "老牌注册商，首年促销力度大，免费终身 WHOIS 隐私保护。",
    true,
    true,
    true,
    ["信用卡", "PayPal", "比特币"],
  ],
  [
    "godaddy",
    "GoDaddy",
    "https://www.godaddy.com",
    "全球最大域名注册商，产品线丰富，续费价格偏高。",
    true,
    false,
    true,
    ["信用卡", "PayPal", "支付宝"],
  ],
  [
    "dynadot",
    "Dynadot",
    "https://www.dynadot.com",
    "价格稳定的注册商，支持中文界面，提供免费隐私保护。",
    true,
    true,
    true,
    ["信用卡", "PayPal", "支付宝", "微信支付"],
  ],
  [
    "namecom",
    "Name.com",
    "https://www.name.com",
    "界面友好的美国注册商，常有促销活动。",
    true,
    false,
    true,
    ["信用卡", "PayPal"],
  ],
  [
    "spaceship",
    "Spaceship",
    "https://www.spaceship.com",
    "Namecheap 旗下新品牌，主打低价与现代化管理面板。",
    true,
    true,
    true,
    ["信用卡", "PayPal"],
  ],
  [
    "aliyun",
    "阿里云（万网）",
    "https://wanwang.aliyun.com",
    "国内最大域名注册商，支持备案与国内解析生态。",
    true,
    false,
    true,
    ["支付宝", "微信支付", "银行卡"],
  ],
]

// tld, 类型, 描述, 是否热门
const TLDS: Array<[string, string, string, boolean]> = [
  ["com", "gTLD", "全球最流行的通用顶级域名，商业首选。", true],
  ["net", "gTLD", "网络服务类通用域名，com 的常见替代。", true],
  ["org", "gTLD", "非营利组织常用的通用域名。", true],
  ["io", "ccTLD", "科技创业公司青睐的英属印度洋领地域名。", true],
  ["dev", "gTLD", "面向开发者的域名，强制 HTTPS。", true],
  ["app", "gTLD", "面向应用程序的域名，强制 HTTPS。", false],
  ["xyz", "gTLD", "价格低廉的新通用域名，注册量大。", true],
  ["ai", "ccTLD", "AI 公司热捧的安圭拉域名。", true],
  ["co", "ccTLD", "哥伦比亚域名，常作为 com 的替代。", false],
  ["me", "ccTLD", "黑山域名，适合个人网站。", false],
  ["cn", "ccTLD", "中国国家顶级域名，需实名认证。", true],
  ["top", "gTLD", "低价新通用域名，国内注册量大。", false],
  ["sh", "ccTLD", "圣赫勒拿域名，开发者常用。", false],
  ["cc", "ccTLD", "科科斯群岛域名，通用性强。", false],
]

async function main() {
  console.log("[v0] 开始创建表结构…")
  await pool.query(DDL)
  console.log("[v0] 表结构创建完成")

  for (const [slug, name, website, description, icann, whois, dnssec, pay] of REGISTRARS) {
    await pool.query(
      `INSERT INTO registrars (slug, name, website, description, icann_accredited, whois_privacy, dnssec, payment_methods)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         website = EXCLUDED.website,
         description = EXCLUDED.description,
         icann_accredited = EXCLUDED.icann_accredited,
         whois_privacy = EXCLUDED.whois_privacy,
         dnssec = EXCLUDED.dnssec,
         payment_methods = EXCLUDED.payment_methods`,
      [slug, name, website, description, icann, whois, dnssec, pay],
    )
  }
  console.log(`[v0] 写入 ${REGISTRARS.length} 个注册商`)

  for (const [tld, type, description, isPopular] of TLDS) {
    await pool.query(
      `INSERT INTO tlds (tld, type, description, is_popular)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tld) DO UPDATE SET
         type = EXCLUDED.type,
         description = EXCLUDED.description,
         is_popular = EXCLUDED.is_popular`,
      [tld, type, description, isPopular],
    )
  }
  console.log(`[v0] 写入 ${TLDS.length} 个域名后缀`)

  await pool.end()
  console.log("[v0] 数据库初始化完成")
}

main().catch((err) => {
  console.error("[v0] 初始化失败：", err)
  process.exit(1)
})
