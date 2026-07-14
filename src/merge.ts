/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */
import type { ContactData } from './types.js'

/**
 * The pure merge planner behind a re-runnable address-book import, matching on
 * `nativeId`. It decides, for each incoming contact, whether to insert,
 * overwrite, or skip; the caller applies the plan inside its own storage
 * transaction. Merge rules:
 *   - no existing row with that `nativeId`: insert.
 *   - existing, `updatedAt === createdAt` (never edited in the wallet):
 *     overwrite with fresh source data. The caller MUST leave `updatedAt =
 *     createdAt` on the overwritten row, so a later re-import keeps refreshing
 *     it and the row stays distinguishable from a wallet edit.
 *   - existing, edited in the wallet (`updatedAt !== createdAt`): skip.
 *   - incoming with null/undefined `nativeId` is never matched, so it always
 *     inserts (a wallet-only contact never absorbs an import).
 *
 * `createdAt`/`updatedAt` are compared by `getTime()`, so a row is treated as
 * never-edited only when the two timestamps are the exact same instant.
 *
 * @param existing the profile's current contact rows
 * @param incoming the freshly imported, already-normalized contacts
 * @returns the insert / overwrite / skip plan
 */
export function planImportMerge(
  existing: {
    _id: string
    createdAt: Date
    updatedAt: Date
    contact: ContactData
  }[],
  incoming: ContactData[]
): {
  inserts: ContactData[]
  overwrites: { _id: string; contact: ContactData }[]
  skips: ContactData[]
} {
  // Index the profile's source-imported rows by nativeId for O(1) matching.
  const byNativeId = new Map<
    string,
    { _id: string; createdAt: Date; updatedAt: Date; contact: ContactData }
  >()
  for (const record of existing) {
    const nativeId = record.contact.nativeId
    if (nativeId != null) {
      byNativeId.set(nativeId, record)
    }
  }

  const inserts: ContactData[] = []
  const overwrites: { _id: string; contact: ContactData }[] = []
  const skips: ContactData[] = []

  for (const contact of incoming) {
    const match =
      contact.nativeId != null ? byNativeId.get(contact.nativeId) : undefined

    if (match === undefined) {
      inserts.push(contact)
      continue
    }

    // Edited in the wallet: wallet edits win, leave it alone.
    if (match.updatedAt.getTime() !== match.createdAt.getTime()) {
      skips.push(contact)
      continue
    }

    // Never edited: overwrite with fresh source data. The caller keeps
    // `updatedAt = createdAt` so the row stays import-refreshable.
    overwrites.push({ _id: match._id, contact })
  }

  return { inserts, overwrites, skips }
}
