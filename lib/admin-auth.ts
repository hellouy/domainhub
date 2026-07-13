import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"

const COOKIE_NAME = "admin_session"

function getSecret() {
  const password = process.env.ADMIN_PASSWORD
  if (!password) throw new Error("ADMIN_PASSWORD 环境变量未设置")
  return password
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("hex")
}

export function verifyPassword(input: string) {
  const expected = Buffer.from(getSecret())
  const actual = Buffer.from(input)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

export async function createAdminSession() {
  const issuedAt = Date.now().toString()
  const token = `${issuedAt}.${sign(issuedAt)}`
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function destroyAdminSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function isAdminAuthenticated() {
  if (!process.env.ADMIN_PASSWORD) return false
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  const [issuedAt, signature] = token.split(".")
  if (!issuedAt || !signature) return false
  const expected = sign(issuedAt)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
