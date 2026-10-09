export function shouldAdvanceBackfillCursor(result: { ok: boolean } | null | undefined): boolean {
  return result?.ok === true
}
