import assert from "node:assert/strict"
import test from "node:test"
import { shouldAdvanceBackfillCursor } from "../services/crawl/backfill-policy"

test("回填游标仅在采集明确成功时推进", () => {
  assert.equal(shouldAdvanceBackfillCursor(null), false)
  assert.equal(shouldAdvanceBackfillCursor(undefined), false)
  assert.equal(shouldAdvanceBackfillCursor({ ok: false }), false)
  assert.equal(shouldAdvanceBackfillCursor({ ok: true }), true)
})
