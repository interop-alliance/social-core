/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */
import type { ContactData } from './types.js'

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
  phoneNumbers?: { label?: string | null; number: string }[] | null
  emailAddresses?: { label?: string | null; email: string }[] | null
  postalAddresses?:
    | {
        label?: string | null
        formattedAddress?: string | null
        street?: string | null
        pobox?: string | null
        neighborhood?: string | null
        city?: string | null
        region?: string | null
        state?: string | null
        postCode?: string | null
        country?: string | null
      }[]
    | null
  imAddresses?: { service?: string | null; username?: string | null }[] | null
  urlAddresses?: { label?: string | null; url?: string | null }[] | null
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

  const phoneNumbers = (input.phoneNumbers ?? []).map(p => ({
    label: normalizeLabel(p.label),
    number: p.number
  }))
  const emailAddresses = (input.emailAddresses ?? []).map(e => ({
    label: normalizeLabel(e.label),
    email: e.email
  }))

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
    pobox: trimmed(a.pobox),
    neighborhood: trimmed(a.neighborhood),
    city: trimmed(a.city),
    region: trimmed(a.region),
    state: trimmed(a.state),
    postCode: trimmed(a.postCode),
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

  // A URL entry with no url (after trim) carries nothing: drop it.
  const urlAddresses = (input.urlAddresses ?? [])
    .map(u => ({ label: normalizeLabel(u.label), url: (u.url ?? '').trim() }))
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
