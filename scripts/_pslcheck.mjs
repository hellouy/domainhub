import pg from "pg"

const PSL_URL = "https://publicsuffix.org/list/public_suffix_list.dat"

async function main() {
  const p = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const q = async (s) => (await p.query(s)).rows

  // 拉 PSL
  const res = await fetch(PSL_URL)
  const text = await res.text()
  const psl = new Set()
  let section = "ICANN"
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (line.startsWith("// ===BEGIN PRIVATE")) section = "PRIVATE"
    if (!line || line.startsWith("//")) continue
    // 去掉通配符/例外前缀
    const rule = line.replace(/^[*!]\.?/, "").toLowerCase()
    psl.add(rule)
  }
  console.log("PSL 规则数:", psl.size)

  // 当前被隐藏的后缀(is_valid=false)
  const hidden = await q("SELECT tld FROM tlds WHERE is_valid = false ORDER BY tld")
  console.log("当前隐藏后缀数:", hidden.length)

  const multi = hidden.filter((r) => r.tld.includes("."))
  const single = hidden.filter((r) => !r.tld.includes("."))
  console.log("  其中多级(含点):", multi.length, " 单标签:", single.length)

  // 多级里: PSL 命中(应恢复) vs 未命中(仍垃圾)
  const recover = multi.filter((r) => psl.has(r.tld.toLowerCase()))
  const stillJunk = multi.filter((r) => !psl.has(r.tld.toLowerCase()))
  console.log("\n多级后缀中 PSL 命中(应恢复为二级域名):", recover.length)
  console.log("  样例:", recover.slice(0, 25).map((r) => r.tld).join(", "))
  console.log("\n多级后缀中 PSL 未命中(仍视为垃圾):", stillJunk.length)
  console.log("  样例:", stillJunk.slice(0, 30).map((r) => r.tld).join(", "))

  // 单标签隐藏里 PSL 命中的(可能被误伤)
  const singleInPsl = single.filter((r) => psl.has(r.tld.toLowerCase()))
  console.log("\n单标签隐藏中 PSL 命中数:", singleInPsl.length, "样例:", singleInPsl.slice(0, 20).map((r) => r.tld).join(", "))

  await p.end()
}
main().catch((e) => { console.error(e.message); process.exit(1) })
