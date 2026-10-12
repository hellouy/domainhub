import { readFileSync } from "node:fs"

const html = readFileSync("/tmp/opencode/vw/icann2.html", "utf8")
const re = /<span[^>]*ng-star-inserted[^>]*>([^<]{3,120}?)\s*-\s*(\d{1,6})<\/span>/g
const icann: string[] = []
let m: RegExpExecArray | null
while ((m = re.exec(html))) icann.push(m[1].trim())
const icannSet = new Set(icann.map((s) => s.toLowerCase()))

const check = (s: string) => console.log(`${s}: ${icannSet.has(s.toLowerCase())}`)

check("hostinger operations, uab")
check("hostpoint ag")
check("gandi sas")
check("namesilo, llc")
check("xserver, inc.")
check("one.com a/s")
check("network solutions, llc")
check("ovh sas")
check("spaceship, inc.")
check("cloudflare, inc.")
check("dynadot inc")
check("name.com, inc.")
check("101domain grs limited")
check("101domain grp limited")
check("porkbun llc")
