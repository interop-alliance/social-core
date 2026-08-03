/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */
import type { ContactData } from './types.js'

/**
 * Strips the `http://` / `https://` prefix that some native contacts UIs
 * prepend to an edited URL, when what remains is a `did:` URI. Any other
 * url is returned unchanged.
 */
export function unmangleDidUrl(url: string): string {
  const stripped = url.replace(/^https?:\/\//i, '')
  return stripped.startsWith('did:') ? stripped : url
}

/**
 * Whether `url` names a DID: a `did:` URI, including a DID URL carrying a
 * path/query/fragment, and including one an address book has mangled with an
 * `http(s)://` prefix. Leading/trailing whitespace is tolerated.
 *
 * The one rule both sides of an edit share: the read side surfaces exactly the
 * entries this accepts, and the write side must refuse a DID row it rejects --
 * an entry that fails the predicate would be persisted and synced yet invisible
 * on every screen, with no way to see or remove it again.
 *
 * The `did:` scheme is required lowercase by DID Core, so the check is
 * case-sensitive.
 */
export function isDidUrl(url: string): boolean {
  return unmangleDidUrl(url.trim()).startsWith('did:')
}

/**
 * The DIDs stored for a contact: every `urlAddresses` entry whose url is a
 * `did:` URI, including DID URLs carrying a path/query/fragment. Matches on
 * the scheme rather than the entry label, since native address books do not
 * reliably round-trip custom labels (the scheme is required lowercase by DID
 * Core, so the check is case-sensitive). Tolerates the `http(s)://` prefix
 * some contacts apps prepend to edited URLs.
 *
 * Deduped, first occurrence winning: a merge from another replica can leave
 * the same DID on two entries, and a contact holding one DID twice means
 * nothing beyond holding it once. The comparison is exact -- DID
 * method-specific ids are case-sensitive, so there is no case folding.
 */
export function getDids(contact: ContactData): string[] {
  return [
    ...new Set(
      (contact.urlAddresses ?? [])
        .filter(entry => isDidUrl(entry.url))
        .map(entry => unmangleDidUrl(entry.url.trim()))
    )
  ]
}

/**
 * Returns a copy of `contact` with its DID entries replaced by `dids`. The
 * write-side counterpart of {@link getDids}: entries whose url is not a
 * `did:` URI (by the same predicate) are carried through untouched, and each
 * DID is appended after them as an entry with the fixed label `'did'`. The
 * DID list is trimmed, blank strings are dropped, and repeats are collapsed
 * to the first occurrence (exact comparison, as in `getDids`). An empty
 * result omits `urlAddresses` entirely, matching the normalized shape.
 */
export function setDids(contact: ContactData, dids: string[]): ContactData {
  const urlAddresses = [
    ...(contact.urlAddresses ?? []).filter(entry => !isDidUrl(entry.url)),
    ...[...new Set(dids.map(did => did.trim()).filter(Boolean))].map(did => ({
      label: 'did',
      url: did
    }))
  ]
  return {
    ...contact,
    urlAddresses: urlAddresses.length > 0 ? urlAddresses : undefined
  }
}
