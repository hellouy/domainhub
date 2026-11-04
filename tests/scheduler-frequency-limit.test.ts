import assert from "node:assert/strict"
import test from "node:test"
import { buildEnqueuePlan, getFrequencyWindowMs } from "../packages/scheduler"

test("频率窗口缺省为 6 小时", () => {
  delete process.env.CRAWL_SCHEDULE_WINDOW_HOURS
  assert.equal(getFrequencyWindowMs(), 6 * 3_600_000)
})

test("频率窗口支持环境变量配置, 非法值回退默认", () => {
  process.env.CRAWL_SCHEDULE_WINDOW_HOURS = "12"
  assert.equal(getFrequencyWindowMs(), 12 * 3_600_000)
  process.env.CRAWL_SCHEDULE_WINDOW_HOURS = "abc"
  assert.equal(getFrequencyWindowMs(), 6 * 3_600_000)
  process.env.CRAWL_SCHEDULE_WINDOW_HOURS = "0"
  assert.equal(getFrequencyWindowMs(), 6 * 3_600_000)
  process.env.CRAWL_SCHEDULE_WINDOW_HOURS = "-3"
  assert.equal(getFrequencyWindowMs(), 6 * 3_600_000)
  delete process.env.CRAWL_SCHEDULE_WINDOW_HOURS
})

test("频率窗口>=24h 输出告警", () => {
  const warnings: string[] = []
  const originalWarn = console.warn
  console.warn = (...args: unknown[]) => warnings.push(String(args[0]))
  try {
    process.env.CRAWL_SCHEDULE_WINDOW_HOURS = "24"
    getFrequencyWindowMs()
  } finally {
    console.warn = originalWarn
    delete process.env.CRAWL_SCHEDULE_WINDOW_HOURS
  }
  assert.equal(warnings.length, 1)
})

test("频率窗口内成功的注册商跳过入队", () => {
  const active = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  const { toEnqueue, skippedIds } = buildEnqueuePlan(active, new Set([2, 4]))
  assert.deepEqual(toEnqueue.map((r) => r.id), [1, 3])
  assert.deepEqual(skippedIds, [2, 4])
})

test("频率查询失败降级为全量入队", () => {
  const active = [{ id: 1 }, { id: 2 }]
  const { toEnqueue, skippedIds } = buildEnqueuePlan(active, null)
  assert.deepEqual(toEnqueue.map((r) => r.id), [1, 2])
  assert.deepEqual(skippedIds, [])
})
