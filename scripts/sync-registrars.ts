/**
 * 同步适配器注册商到数据库
 * ------------------------------------------------------------
 * 所有权: Platform Team
 * 运行: npx tsx scripts/sync-registrars.ts
 *
 * 遍历 allAdapters, 将数据库中不存在的注册商插入 registrars 表
 * (slug 冲突时跳过, 不覆盖已有数据 —— 只增不改)。
 */

import { allAdapters } from "../adapters"
import { db } from "../lib/db"
import { registrars } from "../lib/db/schema"

async function main() {
  for (const adapter of allAdapters) {
    const [row] = await db
      .insert(registrars)
      .values({
        slug: adapter.slug,
        name: adapter.name,
        website: adapter.website ?? "",
        description: "",
        isActive: true,
        owner: adapter.owner,
        adapterVersion: adapter.version,
        priority: adapter.priority,
      })
      .onConflictDoNothing({ target: registrars.slug })
      .returning({ id: registrars.id })
    console.log(row ? `+ 新增 ${adapter.slug} (id=${row.id})` : `= 已存在 ${adapter.slug}`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
