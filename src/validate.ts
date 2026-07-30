/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */
import type {
  ContactData,
  ContactHeadPayload,
  ContactRevisionPayload
} from './types.js'

const CONTACT_ACTIONS = ['create', 'update', 'delete', 'restore'] as const

/** Narrows `x` to a non-null object we can index by string key. */
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

/** Whether `x` is absent (undefined or null) or satisfies `check`. */
function isOptional(x: unknown, check: (v: unknown) => boolean): boolean {
  return x === undefined || x === null || check(x)
}

/** Whether `x` is an array whose every element satisfies `check`. */
function isArrayOf(x: unknown, check: (v: unknown) => boolean): boolean {
  return Array.isArray(x) && x.every(check)
}

function isOptionalString(x: unknown): boolean {
  return isOptional(x, v => typeof v === 'string')
}

function isLabeledNumber(x: unknown): boolean {
  return (
    isRecord(x) &&
    typeof x.label === 'string' &&
    typeof x.number === 'string' &&
    isOptionalString(x.digits) &&
    isOptionalString(x.countryCode) &&
    isOptionalString(x.id)
  )
}

function isLabeledEmail(x: unknown): boolean {
  return (
    isRecord(x) &&
    typeof x.label === 'string' &&
    typeof x.email === 'string' &&
    isOptionalString(x.id)
  )
}

function isPostalAddress(x: unknown): boolean {
  return (
    isRecord(x) &&
    typeof x.label === 'string' &&
    isOptionalString(x.formattedAddress) &&
    isOptionalString(x.street) &&
    isOptionalString(x.poBox) &&
    isOptionalString(x.neighborhood) &&
    isOptionalString(x.city) &&
    isOptionalString(x.region) &&
    isOptionalString(x.postalCode) &&
    isOptionalString(x.country)
  )
}

function isImAddress(x: unknown): boolean {
  return (
    isRecord(x) &&
    typeof x.service === 'string' &&
    typeof x.username === 'string'
  )
}

function isUrlAddress(x: unknown): boolean {
  return isRecord(x) && typeof x.label === 'string' && typeof x.url === 'string'
}

function isBirthday(x: unknown): boolean {
  return (
    isRecord(x) &&
    typeof x.day === 'number' &&
    typeof x.month === 'number' &&
    isOptional(x.year, v => typeof v === 'number')
  )
}

/**
 * Structural guard for {@link ContactData}. Guards the moment one replica
 * decrypts a `contacts` envelope written by the other implementation: required
 * `displayName` string, well-formed `phoneNumbers` / `emailAddresses` arrays,
 * and optional fields either absent or of the right type.
 *
 * The guard checks the fields it knows and ignores any others, so a document
 * stored under the earlier postal-address spellings (`postCode`, `pobox`, and
 * the separate `state`) still validates: decrypt, validate, then
 * `upgradeContactData` -- in either order, since validation tolerates both
 * shapes.
 */
export function isContactData(x: unknown): x is ContactData {
  if (!isRecord(x)) {
    return false
  }
  return (
    typeof x.displayName === 'string' &&
    isArrayOf(x.phoneNumbers, isLabeledNumber) &&
    isArrayOf(x.emailAddresses, isLabeledEmail) &&
    isOptional(x.nativeId, v => typeof v === 'string') &&
    isOptionalString(x.givenName) &&
    isOptionalString(x.middleName) &&
    isOptionalString(x.familyName) &&
    isOptionalString(x.prefix) &&
    isOptionalString(x.suffix) &&
    isOptionalString(x.organization) &&
    isOptionalString(x.jobTitle) &&
    isOptionalString(x.department) &&
    isOptional(x.postalAddresses, v => isArrayOf(v, isPostalAddress)) &&
    isOptional(x.imAddresses, v => isArrayOf(v, isImAddress)) &&
    isOptional(x.urlAddresses, v => isArrayOf(v, isUrlAddress)) &&
    isOptional(x.birthday, isBirthday) &&
    isOptional(x.isStarred, v => typeof v === 'boolean') &&
    isOptionalString(x.note)
  )
}

/**
 * Structural guard for {@link ContactHeadPayload}: the decrypted body of a
 * mutable `contacts` head document. Guards a head envelope written by the other
 * replica before it is fed to the last-write-wins rule.
 */
export function isContactHeadPayload(x: unknown): x is ContactHeadPayload {
  if (!isRecord(x)) {
    return false
  }
  return (
    typeof x.contactId === 'string' &&
    typeof x.updatedAt === 'string' &&
    typeof x.deviceId === 'string' &&
    isContactData(x.contact)
  )
}

/**
 * Structural guard for {@link ContactRevisionPayload}: the decrypted body of an
 * append-only `contacts-history` revision. Requires `action` to be one of the
 * four known kinds; guards a revision envelope written by the other replica.
 */
export function isContactRevisionPayload(
  x: unknown
): x is ContactRevisionPayload {
  if (!isRecord(x)) {
    return false
  }
  return (
    typeof x.contactId === 'string' &&
    typeof x.action === 'string' &&
    (CONTACT_ACTIONS as readonly string[]).includes(x.action) &&
    typeof x.timestamp === 'string' &&
    typeof x.deviceId === 'string' &&
    isContactData(x.snapshot)
  )
}
