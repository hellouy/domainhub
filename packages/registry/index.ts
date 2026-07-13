/**
 * Registry 平台 —— 注册商注册表 / 能力注册表 / 发现元数据
 * ------------------------------------------------------------
 * 所有权: Platform Team
 * 文档: docs/registry.md
 *
 * 两层结构:
 * 1. 内存注册表: 适配器通过 registerAdapter() 自注册(defineAdapter 自动调用)。
 * 2. 数据库注册表: syncAdapterToDb() 将能力/版本/负责人等同步到
 *    registrars / registrar_capabilities / discovery_metadata 表。
 *
 * 业务逻辑通过本模块获取适配器, 不得直接 import 具体适配器文件。
 */

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  discoveryMetadata,
  registrarCapabilities,
  registrars,
} from "@/lib/db/schema"
import type { BaseAdapter } from "@/packages/adapter-sdk/base-adapter"
import type { DiscoveryInfo } from "@/packages/adapter-sdk/types"
import type { HealthSnapshot } from "@/packages/metrics"

// ============================================================
// 内存注册表
// ============================================================

const adapterRegistry = new Map<string, BaseAdapter>()

/** 注册适配器(defineAdapter 自动调用, 幂等) */
export function registerAdapter(adapter: BaseAdapter) {
  adapterRegistry.set(adapter.slug, adapter)
}

/** 按 slug 获取适配器(未注册返回 null) */
export function getRegisteredAdapter(slug: string): BaseAdapter | null {
  return adapterRegistry.get(slug) ?? null
}

/** 列出所有已注册适配器 */
export function listRegisteredAdapters(): BaseAdapter[] {
  return [...adapterRegistry.values()]
}

// ============================================================
// 数据库同步
// ============================================================

/**
 * 将适配器的能力声明/版本/负责人/优先级同步到数据库。
 * 只更新平台化新增列, 不碰既有业务列。
 */
export async function syncAdapterToDb(adapter: BaseAdapter): Promise<void> {
  const [registrar] = await db
    .select({ id: registrars.id })
    .from(registrars)
    .where(eq(registrars.slug, adapter.slug))
    .limit(1)
  if (!registrar) return

  await db
    .update(registrars)
    .set({
      owner: adapter.owner ?? null,
      adapterVersion: adapter.version,
      priority: adapter.priority,
    })
    .where(eq(registrars.id, registrar.id))

  if (adapter.capabilities) {
    await db
      .insert(registrarCapabilities)
      .values({ registrarId: registrar.id, capabilities: adapter.capabilities, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: registrarCapabilities.registrarId,
        set: { capabilities: adapter.capabilities, updatedAt: new Date() },
      })
  }
}

/** 将发现元数据落库(采集成功后由 services 层调用) */
export async function saveDiscoveryMetadata(
  registrarId: number,
  info: DiscoveryInfo,
): Promise<void> {
  const values = {
    registrarId,
    pricingUrl: info.pricingUrl ?? null,
    apiEndpoint: info.apiEndpoint ?? null,
    xhrEndpoint: info.xhrEndpoint ?? null,
    graphqlEndpoint: info.graphqlEndpoint ?? null,
    detectedStrategy: info.detectedStrategy ?? null,
    authRequired: info.authRequired ?? false,
    jsRequired: info.jsRequired ?? false,
    contentType: info.contentType ?? null,
    fingerprint: info.fingerprint ?? null,
    lastVerified: new Date(),
    updatedAt: new Date(),
  }
  await db
    .insert(discoveryMetadata)
    .values(values)
    .onConflictDoUpdate({ target: discoveryMetadata.registrarId, set: values })
}

/** 更新注册商健康快照(registrars.health) */
export async function saveHealthSnapshot(
  registrarId: number,
  health: HealthSnapshot,
): Promise<void> {
  await db.update(registrars).set({ health }).where(eq(registrars.id, registrarId))
}

/** 读取注册商能力(无记录返回 null) */
export async function getCapabilities(registrarId: number) {
  const [row] = await db
    .select()
    .from(registrarCapabilities)
    .where(eq(registrarCapabilities.registrarId, registrarId))
    .limit(1)
  return row ?? null
}

/** 读取发现元数据(无记录返回 null) */
export async function getDiscoveryMetadata(registrarId: number) {
  const [row] = await db
    .select()
    .from(discoveryMetadata)
    .where(eq(discoveryMetadata.registrarId, registrarId))
    .limit(1)
  return row ?? null
}
