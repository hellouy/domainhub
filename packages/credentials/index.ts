/**
 * Credentials 平台
 * ------------------------------------------------------------
 * 所有权: Platform Team
 *
 * 注册商凭证的加密/解密(AES-256-GCM)。
 * 密钥来自 CREDENTIAL_ENCRYPTION_KEY 环境变量(32 字节 hex 或任意字符串经 SHA-256 派生)。
 * 永不从 ADMIN_PASSWORD 派生, 永不明文落库。
 *
 * 密文格式: iv(hex):authTag(hex):ciphertext(hex)
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

export type CredentialType =
  | "api_key"
  | "bearer"
  | "cookie"
  | "session"
  | "basic"
  | "custom_header"

/** 解密后的凭证载荷 */
export interface CredentialPayload {
  type: CredentialType
  /** api_key/bearer: { token }, basic: { username, password }, cookie/session: { cookie }, custom_header: { headerName, headerValue } */
  values: Record<string, string>
}

function getKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY 未设置。请在项目环境变量中添加一个随机密钥(如 openssl rand -hex 32)。",
    )
  }
  // 32 字节 hex 直接使用, 否则 SHA-256 派生
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex")
  return createHash("sha256").update(raw).digest()
}

/** 加密凭证载荷, 返回 iv:tag:ciphertext(hex) */
export function encryptCredential(payload: CredentialPayload): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const plaintext = JSON.stringify(payload)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

/** 解密 iv:tag:ciphertext(hex) 为凭证载荷 */
export function decryptCredential(encryptedPayload: string): CredentialPayload {
  const key = getKey()
  const [ivHex, tagHex, dataHex] = encryptedPayload.split(":")
  if (!ivHex || !tagHex || !dataHex) throw new Error("凭证密文格式无效")
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ])
  return JSON.parse(decrypted.toString("utf8")) as CredentialPayload
}

/** 将凭证载荷转换为 HTTP 请求头(供适配器 fetch 使用) */
export function credentialToHeaders(payload: CredentialPayload): Record<string, string> {
  switch (payload.type) {
    case "api_key":
      return { "X-Api-Key": payload.values.token ?? "" }
    case "bearer":
      return { Authorization: `Bearer ${payload.values.token ?? ""}` }
    case "basic": {
      const token = Buffer.from(
        `${payload.values.username ?? ""}:${payload.values.password ?? ""}`,
      ).toString("base64")
      return { Authorization: `Basic ${token}` }
    }
    case "cookie":
    case "session":
      return { Cookie: payload.values.cookie ?? "" }
    case "custom_header":
      return { [payload.values.headerName ?? "X-Custom"]: payload.values.headerValue ?? "" }
    default:
      return {}
  }
}

/** 脱敏展示(后台列表用), 只保留前 4 位 */
export function maskCredential(payload: CredentialPayload): Record<string, string> {
  const masked: Record<string, string> = {}
  for (const [k, v] of Object.entries(payload.values)) {
    masked[k] = v.length <= 4 ? "****" : `${v.slice(0, 4)}${"*".repeat(Math.min(v.length - 4, 12))}`
  }
  return masked
}
