import { mkdir } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const PUBLIC = path.join(process.cwd(), "public")
const APP = path.join(process.cwd(), "app")
const ORANGE = "#dd5a33"
const CREAM = "#faf9f7"
const INK = "#241f1c"
const MUTED = "#6b6560"

/** 品牌徽标（圆角橙底 + 白色 T + 域名点） */
function badge(size, radius) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="180" height="180" rx="${radius}" fill="${ORANGE}" />
    <path d="M45 58H135" stroke="#fff" stroke-width="15" stroke-linecap="round" />
    <path d="M90 58V128" stroke="#fff" stroke-width="15" stroke-linecap="round" />
    <circle cx="129" cy="123" r="11" fill="#fff" />
  </svg>`
}

/** OpenGraph / Twitter 分享图 1200x630 */
function ogBanner() {
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="${CREAM}" />
    <rect x="0" y="0" width="1200" height="10" fill="${ORANGE}" />
    <g transform="translate(100, 150)">
      <rect width="120" height="120" rx="28" fill="${ORANGE}" />
      <path d="M30 39H90" stroke="#fff" stroke-width="10" stroke-linecap="round" />
      <path d="M60 39V86" stroke="#fff" stroke-width="10" stroke-linecap="round" />
      <circle cx="86" cy="82" r="7.5" fill="#fff" />
    </g>
    <text x="240" y="212" font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="700" fill="${INK}">TLDbi</text>
    <text x="242" y="262" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="400" fill="${MUTED}">tldbi.com</text>
    <text x="100" y="380" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700" fill="${INK}">全球域名注册商价格比价</text>
    <text x="100" y="448" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="400" fill="${MUTED}">Compare domain registration, renewal &amp; transfer prices</text>
    <g font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600" fill="${ORANGE}">
      <text x="100" y="540">Cloudflare</text>
      <text x="290" y="540">Porkbun</text>
      <text x="460" y="540">OVH</text>
      <text x="580" y="540">Dynadot</text>
      <text x="770" y="540">Mythic Beasts</text>
    </g>
  </svg>`
}

await mkdir(PUBLIC, { recursive: true })

const badge32 = Buffer.from(badge(32, 8))
const badge180 = Buffer.from(badge(180, 40))
const badge512 = Buffer.from(badge(512, 114))

await sharp(badge32).png().toFile(path.join(PUBLIC, "icon-light-32x32.png"))
await sharp(badge32).png().toFile(path.join(PUBLIC, "icon-dark-32x32.png"))
await sharp(badge180).png().toFile(path.join(PUBLIC, "apple-icon.png"))
await sharp(badge512).png().toFile(path.join(PUBLIC, "icon-512.png"))

const og = Buffer.from(ogBanner())
await sharp(og).png().toFile(path.join(APP, "opengraph-image.png"))
await sharp(og).png().toFile(path.join(APP, "twitter-image.png"))

console.log("[v0] 品牌资源已生成：favicon / apple-icon / opengraph-image / twitter-image")
