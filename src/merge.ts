/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */
import type { ContactData } from './types.js'
import { getDids } from './dids.js'

/** Display-name normalization for content matching: NFKC, lowercase, single
 * spaces, trimmed. Returns '' when there is nothing to compare. */
function normalizedName(contact: ContactData): string {
  return (contact.displayName ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Digits-only phone keys, preferring the source's own `digits` when it has
 * one; entries that normalize to empty are ignored. */
function phoneKeys(contact: ContactData): Set<string> {
  const keys = new Set<string>()
  for (const entry of contact.phoneNumbers ?? []) {
    const digits =
      entry.digits != null && entry.digits !== ''
        ? entry.digits.replace(/\D/g, '')
        : (entry.number ?? '').replace(/\D/g, '')
    if (digits !== '') {
      keys.add(digits)
    }
  }
  return keys
}

/** Trimmed, lowercased email keys; entries that normalize to empty are
 * ignored. */
function emailKeys(contact: ContactData): Set<string> {
  const keys = new Set<string>()
  for (const entry of contact.emailAddresses ?? []) {
    const email = (entry.email ?? '').trim().toLowerCase()
    if (email !== '') {
      keys.add(email)
    }
  }
  return keys
}

/** The contact's DIDs (from `urlAddresses`, via `getDids`), as a Set. DID
 * URIs are case-sensitive, so they are compared verbatim. */
function didKeys(contact: ContactData): Set<string> {
  return new Set(getDids(contact))
}

/**
 * A canonical JSON rendering of a contact's *content*, used as the exact-match
 * key of the content fallback. Object keys are emitted in sorted order (so two
 * structurally equal contacts assembled in different field orders render
 * identically), `undefined`-valued keys are dropped (absent and explicitly
 * `undefined` mean the same thing here), and array order is significant.
 *
 * The identity / attribution metadata expected to churn is excluded: the
 * contact-level `nativeId` -- the very thing the fallback exists to rebind --
 * and the per-entry `id` diff hints on `phoneNumbers` / `emailAddresses`, which
 * Android can renumber when the OS re-aggregates raw contacts even though
 * nothing the user typed changed. A missing `phoneNumbers` / `emailAddresses`
 * renders like an empty one, since both fields are optional but
 * `normalizeContact` always emits `[]`.
 */
function contentKey(contact: ContactData): string {
  const canonical = (value: unknown, dropEntryId: boolean): unknown => {
    if (Array.isArray(value)) {
      return value.map(entry => canonical(entry, dropEntryId))
    }
    if (value === null || typeof value !== 'object') {
      return value
    }
    const source = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined || (dropEntryId && key === 'id')) {
        continue
      }
      result[key] = canonical(source[key], false)
    }
    return result
  }

  const { nativeId: _nativeId, phoneNumbers, emailAddresses, ...rest } = contact
  return JSON.stringify({
    ...(canonical(rest, false) as Record<string, unknown>),
    phoneNumbers: canonical(phoneNumbers ?? [], true),
    emailAddresses: canonical(emailAddresses ?? [], true)
  })
}

function sharesAny(a: Set<string>, b: Set<string>): boolean {
  for (const key of a) {
    if (b.has(key)) {
      return true
    }
  }
  return false
}

/**
 * The pure merge planner behind a re-runnable address-book import, matching on
 * `nativeId` first and on content second. It decides, for each incoming
 * contact, whether to insert, overwrite, or skip; the caller applies the plan
 * inside its own storage transaction. Merge rules:
 *   - existing row with that `nativeId`, `updatedAt === createdAt` (never
 *     edited in the wallet): overwrite with fresh source data. The caller MUST
 *     leave `updatedAt = createdAt` on the overwritten row, so a later
 *     re-import keeps refreshing it and the row stays distinguishable from a
 *     wallet edit.
 *   - existing row with that `nativeId`, edited in the wallet (`updatedAt !==
 *     createdAt`): skip.
 *   - no row with that `nativeId`: try a content match, so a contact whose
 *     source id churned (notably Android's aggregate id, which changes when the
 *     OS re-links raw contacts) rebinds to its row instead of duplicating it.
 *     Only rows that have a `nativeId` no incoming contact in this batch claims
 *     are candidates, and each row can be claimed by at most one incoming
 *     contact (first match wins, in incoming order). Within one incoming
 *     contact, candidates are tried in `existing` order and the first unclaimed
 *     one wins, so an ambiguous match resolves deterministically. An exact
 *     content match is tried first: equal on every field but the churn-prone id
 *     metadata (the contact's own `nativeId` and the per-entry `id` hints on
 *     phones / emails). It is the strongest signal, and the only rule that
 *     reaches a contact the heuristics below cannot -- e.g. a nameless,
 *     phone-number-only row. Next, a shared DID (from
 *     `urlAddresses`, via `getDids`) matches on its own, even when the display
 *     names differ -- a DID is a real identifier, unlike a name. Otherwise a
 *     candidate matches when the normalized display names are equal and
 *     non-empty AND the two share at least one normalized phone or email -- or,
 *     when both sides have no phones, emails, or DIDs at all, on the name
 *     alone. A matched row that was never
 *     wallet-edited is overwritten (which rebinds it to the incoming
 *     `nativeId`); a wallet-edited one is skipped, keeping the invariant that a
 *     wallet edit is never overwritten by an import while still not duplicating
 *     the row.
 *   - no match either way: insert.
 *   - incoming with null/undefined `nativeId` is never matched, so it always
 *     inserts (a wallet-only contact never absorbs an import). Likewise an
 *     existing wallet-only row (null/undefined `nativeId`) is never matched and
 *     never stale.
 *
 * `stale` reports every existing source-imported row this batch neither matched
 * by `nativeId` nor claimed by content -- orphans whose source id vanished,
 * including wallet-edited ones. It is advisory: the planner never deletes
 * anything, and the caller decides whether to offer cleanup, re-link, or ignore
 * them.
 *
 * `createdAt`/`updatedAt` are compared by `getTime()`, so a row is treated as
 * never-edited only when the two timestamps are the exact same instant.
 *
 * @param existing the profile's current contact rows
 * @param incoming the freshly imported, already-normalized contacts
 * @returns the insert / overwrite / skip plan, plus the advisory stale rows
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
  stale: { _id: string; contact: ContactData }[]
} {
  type Row = {
    _id: string
    createdAt: Date
    updatedAt: Date
    contact: ContactData
  }

  // Index the profile's source-imported rows by nativeId for O(1) matching.
  const byNativeId = new Map<string, Row>()
  for (const record of existing) {
    const nativeId = record.contact.nativeId
    if (nativeId != null) {
      byNativeId.set(nativeId, record)
    }
  }

  // Every nativeId this batch claims. A row whose nativeId is still in the
  // source must never be stolen by the content fallback.
  const incomingNativeIds = new Set<string>()
  for (const contact of incoming) {
    if (contact.nativeId != null) {
      incomingNativeIds.add(contact.nativeId)
    }
  }

  // Fallback candidates, indexed by canonical content, by DID and by
  // normalized display name so the common path stays a couple of map lookups
  // rather than a scan of `existing`.
  const byContent = new Map<string, Row[]>()
  const byDid = new Map<string, Row[]>()
  const byName = new Map<string, Row[]>()
  for (const record of existing) {
    const nativeId = record.contact.nativeId
    if (nativeId == null || incomingNativeIds.has(nativeId)) {
      continue
    }
    const content = contentKey(record.contact)
    const contentBucket = byContent.get(content)
    if (contentBucket === undefined) {
      byContent.set(content, [record])
    } else {
      contentBucket.push(record)
    }
    for (const did of didKeys(record.contact)) {
      const bucket = byDid.get(did)
      if (bucket === undefined) {
        byDid.set(did, [record])
      } else {
        bucket.push(record)
      }
    }
    const name = normalizedName(record.contact)
    if (name === '') {
      continue
    }
    const bucket = byName.get(name)
    if (bucket === undefined) {
      byName.set(name, [record])
    } else {
      bucket.push(record)
    }
  }

  const inserts: ContactData[] = []
  const overwrites: { _id: string; contact: ContactData }[] = []
  const skips: ContactData[] = []
  // Row `_id`s this batch accounted for, by nativeId or by content.
  const claimed = new Set<string>()

  for (const contact of incoming) {
    let match =
      contact.nativeId != null ? byNativeId.get(contact.nativeId) : undefined

    // No row under that nativeId: the source id may have churned, so look for
    // the same contact by content among the rows nothing else claims. An exact
    // content match (everything but the churn-prone id metadata) is the
    // strongest signal, so it is tried first -- it also covers the contacts the
    // DID / name heuristics below cannot reach, such as a nameless
    // phone-number-only row.
    if (match === undefined && contact.nativeId != null) {
      const candidates = byContent.get(contentKey(contact))
      if (candidates !== undefined) {
        match = candidates.find(c => !claimed.has(c._id))
      }
    }

    // A shared DID is decisive on its own (a DID is a real identifier, and the
    // display name may well have been re-edited on either side); otherwise fall
    // back to matching by name.
    if (match === undefined && contact.nativeId != null) {
      const dids = didKeys(contact)
      for (const did of dids) {
        const candidates = byDid.get(did)
        if (candidates === undefined) {
          continue
        }
        match = candidates.find(c => !claimed.has(c._id))
        if (match !== undefined) {
          break
        }
      }
    }
    if (match === undefined && contact.nativeId != null) {
      const name = normalizedName(contact)
      const candidates = name === '' ? undefined : byName.get(name)
      if (candidates !== undefined) {
        const phones = phoneKeys(contact)
        const emails = emailKeys(contact)
        const dids = didKeys(contact)
        for (const candidate of candidates) {
          if (claimed.has(candidate._id)) {
            continue
          }
          const candidatePhones = phoneKeys(candidate.contact)
          const candidateEmails = emailKeys(candidate.contact)
          const candidateDids = didKeys(candidate.contact)
          const bothUnreachable =
            phones.size === 0 &&
            emails.size === 0 &&
            dids.size === 0 &&
            candidatePhones.size === 0 &&
            candidateEmails.size === 0 &&
            candidateDids.size === 0
          if (
            bothUnreachable ||
            sharesAny(phones, candidatePhones) ||
            sharesAny(emails, candidateEmails)
          ) {
            match = candidate
            break
          }
        }
      }
    }

    if (match === undefined) {
      inserts.push(contact)
      continue
    }

    claimed.add(match._id)

    // Edited in the wallet: wallet edits win, leave it alone.
    if (match.updatedAt.getTime() !== match.createdAt.getTime()) {
      skips.push(contact)
      continue
    }

    // Never edited: overwrite with fresh source data. The caller keeps
    // `updatedAt = createdAt` so the row stays import-refreshable. When this
    // came from the content fallback the overwrite also rebinds the row to the
    // incoming contact's new nativeId.
    overwrites.push({ _id: match._id, contact })
  }

  // Source-imported rows this batch never accounted for: advisory only.
  const stale: { _id: string; contact: ContactData }[] = []
  for (const record of existing) {
    if (record.contact.nativeId != null && !claimed.has(record._id)) {
      stale.push({ _id: record._id, contact: record.contact })
    }
  }

  return { inserts, overwrites, skips, stale }
}
