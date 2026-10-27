import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"

async function main() {
  // Enable hover (has 6 prices, adapter works)
  const slugs = ["hover"]
  const result = await db
    .update(registrars)
    .set({ isActive: true })
    .where(inArray(registrars.slug, slugs))
    .returning({ id: registrars.id, slug: registrars.slug, name: registrars.name })

  for (const r of result) {
    console.log(`Enabled: [${r.id}] ${r.slug} (${r.name})`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
