import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import { eq, sql } from "drizzle-orm"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { adminLoginAttempts } from "@/lib/db/schema"

const COOKIE_NAME = "admin_session"
const SESSION_TTL_MS = 60 * 60 * 24 * 7 * 1000

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

const LOGIN_FAILURE_LIMIT = 5

function loginIpHash(ipAddress: string): string {
  return createHmac("sha256", getSecret()).update(ipAddress).digest("hex")
}

export async function isAdminLoginBlocked(ipAddress: string): Promise<boolean> {
  const [attempt] = await db
    .select({ lockedUntil: adminLoginAttempts.lockedUntil })
    .from(adminLoginAttempts)
    .where(eq(adminLoginAttempts.ipHash, loginIpHash(ipAddress)))
    .limit(1)
  return Boolean(attempt?.lockedUntil && attempt.lockedUntil.getTime() > Date.now())
}

export async function recordAdminLoginFailure(ipAddress: string): Promise<void> {
  const now = new Date()
  const ipHash = loginIpHash(ipAddress)
  await db
    .insert(adminLoginAttempts)
    .values({ ipHash, failedAttempts: 1, windowStartedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: adminLoginAttempts.ipHash,
      set: {
        failedAttempts: sql`CASE WHEN ${adminLoginAttempts.windowStartedAt} < NOW() - INTERVAL '15 minutes' THEN 1 ELSE ${adminLoginAttempts.failedAttempts} + 1 END`,
        windowStartedAt: sql`CASE WHEN ${adminLoginAttempts.windowStartedAt} < NOW() - INTERVAL '15 minutes' THEN NOW() ELSE ${adminLoginAttempts.windowStartedAt} END`,
        lockedUntil: sql`CASE WHEN ${adminLoginAttempts.lockedUntil} > NOW() THEN ${adminLoginAttempts.lockedUntil} WHEN ${adminLoginAttempts.windowStartedAt} < NOW() - INTERVAL '15 minutes' THEN NULL WHEN ${adminLoginAttempts.failedAttempts} + 1 >= ${LOGIN_FAILURE_LIMIT} THEN NOW() + INTERVAL '15 minutes' ELSE ${adminLoginAttempts.lockedUntil} END`,
        updatedAt: now,
      },
    })
}

export async function clearAdminLoginFailures(ipAddress: string): Promise<void> {
  await db.delete(adminLoginAttempts).where(eq(adminLoginAttempts.ipHash, loginIpHash(ipAddress)))
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
  if (!timingSafeEqual(a, b)) return false
  const issuedAtMs = Number(issuedAt)
  if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > SESSION_TTL_MS) return false
  return true
}
