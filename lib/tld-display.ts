/**
 * TLD 显示工具：punycode (xn--) → Unicode，并判定是否为 IDN 后缀。
 * 自包含 RFC 3492 解码器，兼容 server / client / edge 运行时。
 */

/** 判断 TLD 是否为 IDN（punycode 编码或含非 ASCII 字符） */
export function isIdnTld(tld: string): boolean {
  const clean = tld.replace(/^\./, "")
  const lastLabel = clean.split(".").pop() ?? clean
  if (lastLabel.startsWith("xn--")) return true
  return /[^\x00-\x7F]/.test(lastLabel)
}

const BASE = 36
const TMIN = 1
const TMAX = 26
const SKEW = 38
const DAMP = 700
const INITIAL_BIAS = 72
const INITIAL_N = 128

function decodeDigit(cp: number): number {
  if (cp >= 48 && cp <= 57) return cp - 22 // 0-9
  if (cp >= 65 && cp <= 90) return cp - 65 // A-Z
  if (cp >= 97 && cp <= 122) return cp - 97 // a-z
  return BASE
}

function adapt(delta: number, numpoints: number, firsttime: boolean): number {
  let d = firsttime ? Math.floor(delta / DAMP) : Math.floor(delta / 2)
  d += Math.floor(d / numpoints)
  let k = 0
  while (d > Math.floor((BASE - TMIN) * TMAX) / 2) {
    d = Math.floor(d / (BASE - TMIN))
    k += BASE
  }
  return k + Math.floor((BASE - TMIN + 1) * d / (d + SKEW))
}

/** 解码单个 punycode 标签（不含 xn-- 前缀）为 Unicode 字符串 */
function punycodeDecode(input: string): string {
  const output: number[] = []
  let n = INITIAL_N
  let bias = INITIAL_BIAS
  let i = 0

  // 处理基本字符（ASCII 部分，在最后一个 delimeter 之后）
  const basicEnd = input.lastIndexOf("-")
  const basic = basicEnd > 0 ? input.slice(0, basicEnd) : ""
  for (const ch of basic) {
    const cp = ch.codePointAt(0)!
    if (cp < 128) output.push(cp)
  }

  let idx = basicEnd > 0 ? basicEnd + 1 : 0
  const extended = input.slice(idx)
  let pos = 0

  while (pos < extended.length) {
    const oldi = i
    let w = 1
    for (let k = BASE; ; k += BASE) {
      if (pos >= extended.length) return String.fromCodePoint(...output)
      const digit = decodeDigit(extended.charCodeAt(pos))
      pos++
      i += digit * w
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias
      if (digit < t) break
      w *= BASE - t
    }
    const outlen = output.length + 1
    bias = adapt(i - oldi, outlen, oldi === 0)
    n += Math.floor(i / outlen)
    i %= outlen
    output.splice(i, 0, n)
    i++
  }

  return String.fromCodePoint(...output)
}

/**
 * 将 TLD 转为 Unicode 显示形式。
 * - 普通 TLD 原样返回（"com" → "com"）
 * - punycode TLD 解码（"xn--fiqs8s" → "中国"）
 * - 多级后缀只解码最后一段 xn-- 标签
 */
export function tldToUnicode(tld: string): string {
  const clean = tld.replace(/^\./, "")
  const labels = clean.split(".")
  const decoded = labels.map((label) => {
    if (label.startsWith("xn--")) {
      try {
        return punycodeDecode(label.slice(4))
      } catch {
        return label
      }
    }
    return label
  })
  return decoded.join(".")
}

/** 带「.」前缀的 Unicode 显示形式（"xn--fiqs8s" → ".中国"） */
export function tldDisplay(tld: string): string {
  return "." + tldToUnicode(tld)
}
