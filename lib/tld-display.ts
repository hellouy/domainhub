/**
 * IDN(国际化域名)后缀显示工具。
 *
 * 数据库里 IDN 后缀以 punycode ASCII 形式存储(如 "xn--ses554g"), 这是 DNS / URL
 * 的规范形式, 用作路由与主键。但直接展示给用户是乱码, 应还原为真实 Unicode 后缀
 * (如 "网址")。本工具在**展示层**做 punycode→Unicode 转换, 不改动存储与路由。
 *
 * 自实现 RFC 3492 解码, 无第三方依赖, 同时可在 Server / Client 组件运行
 * (Node 的 url.domainToUnicode 仅服务端可用, 故不采用)。
 */

const BASE = 36
const T_MIN = 1
const T_MAX = 26
const SKEW = 38
const DAMP = 700
const INITIAL_BIAS = 72
const INITIAL_N = 128
const DELIMITER = "-"

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1
  delta += Math.floor(delta / numPoints)
  let k = 0
  while (delta > ((BASE - T_MIN) * T_MAX) >> 1) {
    delta = Math.floor(delta / (BASE - T_MIN))
    k += BASE
  }
  return Math.floor(k + ((BASE - T_MIN + 1) * delta) / (delta + SKEW))
}

/** 单个 base-36 数字字符 → 数值(a-z=0..25, 0-9=26..35) */
function decodeDigit(codePoint: number): number {
  if (codePoint - 48 < 10) return codePoint - 22 // '0'-'9'
  if (codePoint - 65 < 26) return codePoint - 65 // 'A'-'Z'
  if (codePoint - 97 < 26) return codePoint - 97 // 'a'-'z'
  return BASE
}

/** 解码单个 punycode 标签(不含 "xn--" 前缀) */
function decodePunycode(input: string): string {
  const output: number[] = []
  let n = INITIAL_N
  let bias = INITIAL_BIAS
  let i = 0

  let basic = input.lastIndexOf(DELIMITER)
  if (basic < 0) basic = 0
  for (let j = 0; j < basic; j++) {
    output.push(input.charCodeAt(j))
  }

  let index = basic > 0 ? basic + 1 : 0
  while (index < input.length) {
    const oldi = i
    for (let w = 1, k = BASE; ; k += BASE) {
      if (index >= input.length) throw new Error("punycode: 输入不完整")
      const digit = decodeDigit(input.charCodeAt(index++))
      if (digit >= BASE) throw new Error("punycode: 非法数字")
      i += digit * w
      const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias
      if (digit < t) break
      w *= BASE - t
    }
    const out = output.length + 1
    bias = adapt(i - oldi, out, oldi === 0)
    n += Math.floor(i / out)
    i %= out
    output.splice(i++, 0, n)
  }
  return String.fromCodePoint(...output)
}

/**
 * 将后缀转为用于展示的 Unicode 形式。
 * - "xn--ses554g" → "网址"
 * - "com" → "com"(原样)
 * - 多段(理论上后缀不含点, 但稳妥处理)逐段转换
 * 解码失败时回退原值, 保证永不抛错影响渲染。
 */
export function toUnicodeTld(tld: string | null | undefined): string {
  if (!tld) return tld ?? ""
  return tld
    .split(".")
    .map((label) => {
      if (label.toLowerCase().startsWith("xn--")) {
        try {
          return decodePunycode(label.slice(4))
        } catch {
          return label
        }
      }
      return label
    })
    .join(".")
}

/** 是否为 IDN(punycode)后缀 */
export function isIdnTld(tld: string | null | undefined): boolean {
  return !!tld && tld.toLowerCase().includes("xn--")
}
