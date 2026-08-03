/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */

/**
 * The presentation rules both wallets render a contact with: the initials
 * avatar, the secondary line under a name, the search predicate and list
 * order, and the revision-history snapshot lines. Pure string/array work over
 * `ContactData` -- no DOM, no framework -- so the two replicas cannot show the
 * same contact differently.
 */
import type { ContactAction, ContactData } from './types.js'
import { getDids } from './dids.js'

/**
 * Builds up-to-two-letter initials from a display name (contact photos are
 * never stored, so both wallets render an initials avatar instead).
 *
 * The rule is FIRST + LAST whitespace-separated token, uppercased: a
 * three-token name reads as its first and family initials rather than its
 * first two, which is what a middle name or a title would otherwise produce.
 * A single token yields one letter, and a name that is empty (or only
 * whitespace) yields `'?'`.
 */
export function initialsFor(displayName: string): string {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean)
  const first = parts[0]
  const last = parts[parts.length - 1]
  if (first === undefined || last === undefined) {
    return '?'
  }
  return (
    first.charAt(0) + (parts.length > 1 ? last.charAt(0) : '')
  ).toUpperCase()
}

/**
 * The single line shown under the name in a contact list: the organization,
 * else the first phone number, else the first email address. An empty string
 * when the contact carries none of them -- the caller renders nothing rather
 * than an empty row.
 */
export function secondaryLineFor(contact: ContactData): string {
  if (contact.organization) {
    return contact.organization
  }
  const firstPhone = (contact.phoneNumbers ?? [])[0]
  if (firstPhone) {
    return firstPhone.number
  }
  const firstEmail = (contact.emailAddresses ?? [])[0]
  if (firstEmail) {
    return firstEmail.email
  }
  return ''
}

/**
 * Case-insensitive substring match of a search query against a contact's
 * searchable fields: display name, organization, phone numbers, email
 * addresses, and DIDs (by {@link getDids}, so a mangled `http(s)://did:` entry
 * is searchable in its unmangled form). The fields are joined with a single
 * space and matched as one haystack, so a query can run across a field
 * boundary (a name followed by an organization, say).
 *
 * A blank query matches every contact; the caller decides whether to filter at
 * all.
 */
export function contactMatchesQuery(
  contact: ContactData,
  query: string
): boolean {
  const haystack = [
    contact.displayName,
    contact.organization ?? '',
    ...(contact.phoneNumbers ?? []).map(entry => entry.number),
    ...(contact.emailAddresses ?? []).map(entry => entry.email),
    ...getDids(contact)
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.trim().toLowerCase())
}

/**
 * The list order both wallets sort a contact list with: by display name, using
 * the runtime's locale-aware comparison. Shaped as an `Array.prototype.sort`
 * comparator.
 */
export function compareContactsByName(
  first: ContactData,
  second: ContactData
): number {
  return first.displayName.localeCompare(second.displayName)
}

/**
 * The human-readable label for each contact mutation kind, as shown in the
 * revision history. A wallet with a translation layer passes the action
 * through it instead; this is the untranslated default.
 */
export const ACTION_LABELS: Record<ContactAction, string> = {
  create: 'Created',
  update: 'Edited',
  delete: 'Deleted',
  restore: 'Restored'
}

/**
 * The plain-text lines summarizing a history snapshot, in display order: the
 * display name, the organization, each labeled phone number, each labeled
 * email address, each labeled url, and the note. Fields the snapshot does not
 * carry contribute no line, so an expanded revision never shows empty rows.
 */
export function snapshotLines(snapshot: ContactData): string[] {
  const lines = [snapshot.displayName]
  if (snapshot.organization) {
    lines.push(snapshot.organization)
  }
  for (const entry of snapshot.phoneNumbers ?? []) {
    lines.push(`${entry.label}: ${entry.number}`)
  }
  for (const entry of snapshot.emailAddresses ?? []) {
    lines.push(`${entry.label}: ${entry.email}`)
  }
  for (const entry of snapshot.urlAddresses ?? []) {
    lines.push(`${entry.label}: ${entry.url}`)
  }
  if (snapshot.note) {
    lines.push(snapshot.note)
  }
  return lines
}
