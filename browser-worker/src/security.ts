import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const DNS_TIMEOUT_MS = 5_000

export function isPublicAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) {
    const [a, b, c, d] = address.split(".").map(Number)
    const value = (a << 24) | (b << 16) | (c << 8) | d
    const blocked = [
      [(0 << 24) >>> 0, 8],
      [(10 << 24) >>> 0, 8],
      [(100 << 24) | (64 << 16), 10],
      [(127 << 24) >>> 0, 8],
      [(169 << 24) | (254 << 16), 16],
      [(172 << 24) | (16 << 16), 12],
      [(192 << 24) | (0 << 16), 24],
      [(192 << 24) | (0 << 16) | (2 << 8), 24],
      [(192 << 24) | (88 << 16) | (99 << 8), 24],
      [(192 << 24) | (168 << 16), 16],
      [(198 << 24) | (18 << 16), 15],
      [(198 << 24) | (51 << 16) | (100 << 8), 24],
      [(203 << 24) | (0 << 16) | (113 << 8), 24],
      [(224 << 24) >>> 0, 3],
      [(240 << 24) >>> 0, 4],
    ]
    return !blocked.some(([network, prefix]) => {
      const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
      return ((value >>> 0) & mask) === (network! & mask)
    })
  }
  if (version === 6) {
    const normalized = address.toLowerCase().split("%")[0]
    if (normalized.startsWith("::ffff:")) return false
    const halves = normalized.split("::")
    const left = halves[0] ? halves[0].split(":") : []
    const right = halves[1] ? halves[1].split(":") : []
    const groups = halves.length === 2
      ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
      : left
    if (groups.length !== 8) return false
    const first = Number.parseInt(groups[0] ?? "", 16)
    const second = Number.parseInt(groups[1] ?? "", 16)
    const isGlobalUnicast = first >= 0x2000 && first <= 0x3fff
    const isDocumentation = first === 0x2001 && second === 0x0db8
    return isGlobalUnicast && !isDocumentation
  }
  return false
}

async function resolveHost(hostname: string): Promise<Array<{ address: string }>> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("目标主机 DNS 解析超时")), DNS_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error("URL 格式无效")
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("仅允许无凭据的 HTTP(S) 公网 URL")
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new Error("仅允许 HTTP(S) 默认端口")
  }

  const hostname = url.hostname.toLowerCase().replaceAll("[", "").replaceAll("]", "").replace(/\.$/, "")
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("禁止访问本地主机")
  }

  const literalVersion = isIP(hostname)
  const addresses = literalVersion ? [{ address: hostname }] : await resolveHost(hostname)
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("URL 解析到非公网地址，已阻止请求")
  }
}
