import pg from "pg"

const PSL_URL = "https://publicsuffix.org/list/public_suffix_list.dat"

async function main() {
  const p = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const q = async (s) => (await p.query(s)).rows

  const res = await fetch(PSL_URL)
  const text = await res.text()
  const rules = new Set()      // 普通规则 e.g. "com.cn"
  const wildcards = new Set()  // "*.ck" => 存 "ck"
  const exceptions = new Set() // "!www.ck" => 存 "www.ck"
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("//")) continue
    if (line.startsWith("!")) { exceptions.add(line.slice(1).toLowerCase()); continue }
    if (line.startsWith("*.")) { wildcards.add(line.slice(2).toLowerCase()); continue }
    rules.add(line.toLowerCase())
  }
  console.log("PSL 普通规则:", rules.size, " 通配:", wildcards.size, " 例外:", exceptions.size)

  // 判定 X 是否为公共后缀(可注册二级域名后缀)
  const isPublicSuffix = (x) => {
    x = x.toLowerCase()
    if (exceptions.has(x)) return true
    if (rules.has(x)) return true
    const parent = x.split(".").slice(1).join(".")
    if (parent && wildcards.has(parent)) return true // 匹配 *.parent
    return false
  }

  const hidden = await q("SELECT tld FROM tlds WHERE is_valid = false ORDER BY tld")
  console.log("当前隐藏后缀数:", hidden.length)
  const multi = hidden.filter((r) => r.tld.includes("."))
  const single = hidden.filter((r) => !r.tld.includes("."))
  console.log("  多级(含点):", multi.length, " 单标签:", single.length)

  const recover = multi.filter((r) => isPublicSuffix(r.tld))
  const stillJunk = multi.filter((r) => !isPublicSuffix(r.tld))
  console.log("\n多级 PSL 命中(应恢复):", recover.length)
  console.log("\n多级 PSL 未命中(仍垃圾):", stillJunk.length)
  console.log("  全部:", stillJunk.map((r) => r.tld).join(", "))

  const singleInPsl = single.filter((r) => isPublicSuffix(r.tld))
  console.log("\n单标签隐藏中 PSL 命中:", singleInPsl.length, singleInPsl.slice(0, 20).map((r) => r.tld).join(", "))
  await p.end()
}
main().catch((e) => { console.error(e.message); process.exit(1) })
