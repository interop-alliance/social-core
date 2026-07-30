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
 * The DIDs stored for a contact: every `urlAddresses` entry whose url is a
 * `did:` URI, including DID URLs carrying a path/query/fragment. Matches on
 * the scheme rather than the entry label, since native address books do not
 * reliably round-trip custom labels (the scheme is required lowercase by DID
 * Core, so the check is case-sensitive). Tolerates the `http(s)://` prefix
 * some contacts apps prepend to edited URLs.
 */
export function getDids(contact: ContactData): string[] {
  return (contact.urlAddresses ?? [])
    .map(u => unmangleDidUrl(u.url.trim()))
    .filter(url => url.startsWith('did:'))
}
