/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */
import type { ContactData } from './types.js'
import { unmangleDidUrl } from './dids.js'

/**
 * An already-source-mapped partial contact: the raw fields a platform's contact
 * importer pulls out of its address book, before normalization. Every field is
 * optional/nullable so a mapper can pass through whatever the source provides;
 * `normalizeContact` trims, applies the display-name fallback, and drops empty
 * entries. Exported so app-side mappers (the phone / browser importers) can
 * type the object they hand in.
 */
export type ContactInput = {
  nativeId?: string | null
  displayName?: string | null
  givenName?: string | null
  middleName?: string | null
  familyName?: string | null
  prefix?: string | null
  suffix?: string | null
  organization?: string | null
  jobTitle?: string | null
  department?: string | null
  /**
   * An entry whose `number` is empty after trimming carries nothing and is
   * dropped (before the "is there any contact method?" keep/drop decision), so
   * a source that hands back placeholder entries cannot resurrect a contact
   * that has no name and no reachable number. `id`, when the source provides
   * one, identifies the entry within the source contact -- a diff hint rather
   * than permanent identity, since on Android sub-record ids can churn when
   * the OS re-aggregates raw contacts across accounts.
   */
  phoneNumbers?:
    | {
        label?: string | null
        number?: string | null
        digits?: string | null
        countryCode?: string | null
        id?: string | null
      }[]
    | null
  /**
   * An entry whose `email` is empty after trimming is dropped, on the same
   * terms as `phoneNumbers`; `id` carries the same diff-hint-only caveat.
   */
  emailAddresses?:
    | { label?: string | null; email?: string | null; id?: string | null }[]
    | null
  postalAddresses?:
    | {
        label?: string | null
        formattedAddress?: string | null
        street?: string | null
        poBox?: string | null
        neighborhood?: string | null
        city?: string | null
        region?: string | null
        postalCode?: string | null
        country?: string | null
      }[]
    | null
  imAddresses?: { service?: string | null; username?: string | null }[] | null
  urlAddresses?: { label?: string | null; url?: string | null }[] | null
  /**
   * `month` is 1-INDEXED (1 = January), matching how address books present a
   * birthday; `normalizeContact` requires `month > 0`. An importer whose
   * source uses the 0-indexed JS `Date` convention MUST add 1 before calling:
   * passing a raw 0-indexed month would silently drop every January birthday
   * and shift all the others back by one.
   */
  birthday?: {
    day?: number | null
    month?: number | null
    year?: number | null
  } | null
  isStarred?: boolean | null
  note?: string | null
}

/** Lowercases and trims a native label, falling back to `other` when empty. */
export function normalizeLabel(label: string | null | undefined): string {
  const normalized = (label ?? '').trim().toLowerCase()
  return normalized.length > 0 ? normalized : 'other'
}

/** Trims an optional string, mapping empty (or absent) to `undefined`. */
function trimmed(value: string | null | undefined): string | undefined {
  return (value ?? '').trim() || undefined
}

/** Whether `value` is a finite positive number (a plausible day/month). */
function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Normalizes an already-source-mapped partial contact to our `ContactData`, or
 * `null` for entries with no name AND no phone/email (nothing worth importing).
 * Photos are never carried: thumbnails would bloat the encrypted sync
 * envelopes, so a wallet renders initials avatars instead.
 *
 * Phone / email entries whose number / address is empty after trimming are
 * dropped first, so they never count toward "has a contact method".
 *
 * Optional array fields (`postalAddresses`, `imAddresses`, `urlAddresses`) are
 * omitted entirely when empty after normalization -- only `phoneNumbers` /
 * `emailAddresses` stay required with an `[]` default -- so a contact without
 * them serializes byte-identically to the pre-expansion shape.
 */
export function normalizeContact(input: ContactInput): ContactData | null {
  const givenName = (input.givenName ?? '').trim()
  const familyName = (input.familyName ?? '').trim()
  const displayName =
    (input.displayName ?? '').trim() || `${givenName} ${familyName}`.trim()

  // A phone / email entry with no number / address (after trim) carries
  // nothing: drop it BEFORE deciding whether the contact has any contact
  // method at all, so placeholder entries cannot keep a nameless contact.
  const phoneNumbers = (input.phoneNumbers ?? [])
    .map(p => ({
      label: normalizeLabel(p.label),
      number: (p.number ?? '').trim(),
      digits: trimmed(p.digits),
      countryCode: trimmed(p.countryCode),
      id: trimmed(p.id)
    }))
    .filter(p => p.number !== '')
  const emailAddresses = (input.emailAddresses ?? [])
    .map(e => ({
      label: normalizeLabel(e.label),
      email: (e.email ?? '').trim(),
      id: trimmed(e.id)
    }))
    .filter(e => e.email !== '')

  const hasContactMethod = phoneNumbers.length > 0 || emailAddresses.length > 0
  if (displayName === '' && !hasContactMethod) {
    return null
  }

  const contact: ContactData = {
    nativeId: input.nativeId,
    displayName,
    givenName: givenName || undefined,
    middleName: trimmed(input.middleName),
    familyName: familyName || undefined,
    prefix: trimmed(input.prefix),
    suffix: trimmed(input.suffix),
    organization: trimmed(input.organization),
    jobTitle: trimmed(input.jobTitle),
    department: trimmed(input.department),
    phoneNumbers,
    emailAddresses,
    note: trimmed(input.note)
  }

  const postalAddresses = (input.postalAddresses ?? []).map(a => ({
    label: normalizeLabel(a.label),
    formattedAddress: trimmed(a.formattedAddress),
    street: trimmed(a.street),
    poBox: trimmed(a.poBox),
    neighborhood: trimmed(a.neighborhood),
    city: trimmed(a.city),
    region: trimmed(a.region),
    postalCode: trimmed(a.postalCode),
    country: trimmed(a.country)
  }))
  if (postalAddresses.length > 0) {
    contact.postalAddresses = postalAddresses
  }

  // An IM entry with no username (after trim) carries nothing: drop it.
  const imAddresses = (input.imAddresses ?? [])
    .map(im => ({
      service: (im.service ?? '').trim(),
      username: (im.username ?? '').trim()
    }))
    .filter(im => im.username !== '')
  if (imAddresses.length > 0) {
    contact.imAddresses = imAddresses
  }

  // A URL entry with no url (after trim) carries nothing: drop it. Undo the
  // `http(s)://` prefix some contacts apps prepend to an edited `did:` URI,
  // so stored data is clean regardless of import source.
  const urlAddresses = (input.urlAddresses ?? [])
    .map(u => ({
      label: normalizeLabel(u.label),
      url: unmangleDidUrl((u.url ?? '').trim())
    }))
    .filter(u => u.url !== '')
  if (urlAddresses.length > 0) {
    contact.urlAddresses = urlAddresses
  }

  // A birthday needs at least a plausible day + month; the year is optional.
  const birthday = input.birthday
  if (
    birthday != null &&
    isPositive(birthday.day) &&
    isPositive(birthday.month)
  ) {
    contact.birthday = {
      day: birthday.day,
      month: birthday.month,
      ...(typeof birthday.year === 'number' && Number.isFinite(birthday.year)
        ? { year: birthday.year }
        : {})
    }
  }

  // Only an explicit `true` is meaningful; false/absent stays off the wire.
  if (input.isStarred === true) {
    contact.isStarred = true
  }

  return contact
}
