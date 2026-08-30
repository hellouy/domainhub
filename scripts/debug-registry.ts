import "@/adapters"
import { listRegisteredAdapters, getRegisteredAdapter } from "@/packages/registry"

function main() {
  const all = listRegisteredAdapters()
  console.log(`已注册 ${all.length} 家:`)
  console.log(all.map((a) => a.slug).join(", "))
  for (const s of ["directnic", "dreamhost", "forpsi", "juming", "blacknight", "namesilo", "exabytes", "networksolutions"]) {
    const a = getRegisteredAdapter(s)
    console.log(`${s}: ${a ? "REGISTERED (" + a.name + ")" : "NOT-REGISTERED"}`)
  }
}
main()