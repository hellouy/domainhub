import type { RegistrarAdapter } from "./types"

/**
 * RegistrarRegistry（Sprint 4 Part 7）
 *
 * 所有 Adapter 通过 `registrarRegistry.register(adapter, metadata)` 自动注册。
 * 未来新增注册商只需：新建 Adapter 文件 + 在 adapters/index.ts 调用一次 register，
 * 其余（Runner 调度、后台展示、覆盖率统计）全部自动生效。
 */

/** 数据源类型 */
export type SourceType = "api" | "json" | "html" | "playwright" | "seed"

export interface AdapterMetadata {
  /** 数据源类型 */
  sourceType: SourceType
  /** 调度优先级（数字越小越先运行，默认 100） */
  priority: number
  /** Adapter 状态 */
  status: "active" | "experimental" | "deprecated"
  /** Adapter 版本 */
  version: string
  /** 官网（后台展示） */
  website?: string
}

export interface AdapterRegistration {
  adapter: RegistrarAdapter
  metadata: AdapterMetadata
}

const DEFAULT_METADATA: AdapterMetadata = {
  sourceType: "seed",
  priority: 100,
  status: "active",
  version: "1.0.0",
}

export class RegistrarRegistry {
  private registrations = new Map<string, AdapterRegistration>()

  /** 注册一个 Adapter（同 slug 后注册的覆盖先注册的，用于真实 Adapter 覆盖 Demo） */
  register(adapter: RegistrarAdapter, metadata: Partial<AdapterMetadata> = {}): this {
    this.registrations.set(adapter.slug, {
      adapter,
      metadata: { ...DEFAULT_METADATA, ...metadata },
    })
    return this
  }

  get(slug: string): RegistrarAdapter | undefined {
    return this.registrations.get(slug)?.adapter
  }

  getRegistration(slug: string): AdapterRegistration | undefined {
    return this.registrations.get(slug)
  }

  /** 全部 Adapter（按优先级排序） */
  list(): RegistrarAdapter[] {
    return this.listRegistrations().map((r) => r.adapter)
  }

  /** 全部注册信息（含元数据，按优先级排序） */
  listRegistrations(): AdapterRegistration[] {
    return [...this.registrations.values()].sort((a, b) => a.metadata.priority - b.metadata.priority)
  }

  /** 按数据源类型统计（后台覆盖率中心使用） */
  countBySourceType(): Record<SourceType, number> {
    const counts: Record<SourceType, number> = { api: 0, json: 0, html: 0, playwright: 0, seed: 0 }
    for (const { metadata } of this.registrations.values()) {
      counts[metadata.sourceType]++
    }
    return counts
  }
}

/** 全局单例 */
export const registrarRegistry = new RegistrarRegistry()
