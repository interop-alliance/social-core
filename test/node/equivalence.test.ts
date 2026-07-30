import { describe, it, expect } from 'vitest'
import { normalizeContact, upgradeContactData } from '../../src/index.js'
import type { ContactData, ContactInput } from '../../src/index.js'

/**
 * One fixture person, imported through two different address-book libraries,
 * guarding against unintended normalization drift when a wallet swaps its
 * import source.
 *
 * `ContactInput` has exactly one spelling per field, so mapping a library's
 * own field names onto it is each adapter's job; the two `adapt*` helpers
 * below stand in for those adapters. Both are responsible for handing
 * `normalizeContact` a 1-indexed birthday month and for folding their
 * source's administrative-subdivision field into `region`.
 *
 * Serialization is the sync boundary, so the assertions compare
 * `JSON.stringify` output, not just deep equality.
 */

/**
 * The fixture person as the older library reports her: a single record id,
 * `postCode` / `pobox` spellings, a `state` rather than a `region`, and no
 * per-entry ids anywhere.
 */
const fromOlderLibrary = {
  recordID: 'contact-42',
  displayName: 'Ada Lovelace',
  givenName: 'Ada',
  middleName: 'Augusta',
  familyName: 'Lovelace',
  prefix: 'Countess',
  company: 'Analytical Engines',
  jobTitle: 'Mathematician',
  phoneNumbers: [
    { label: 'MOBILE', number: '+1 555-0100' },
    { label: 'home', number: '' }
  ],
  emailAddresses: [{ label: 'Work', email: 'ada@example.com' }],
  postalAddresses: [
    {
      label: 'HOME',
      street: '1 Engine Way',
      city: 'London',
      state: 'Greater London',
      postCode: 'N1',
      country: 'UK'
    }
  ],
  urlAddresses: [{ label: 'blog', url: 'https://ada.example' }],
  // 1-indexed month, as this library reports it.
  birthday: { day: 10, month: 12, year: 1815 },
  isStarred: true,
  note: 'met at a conference'
}

/**
 * The same person as the newer library reports her: `id` instead of
 * `recordID`, `phones` / `emails` (element field `address`) with per-entry
 * ids, `addresses` carrying both `region` and `state` plus a lowercase
 * `postcode`, and a British-spelled favourite flag.
 */
const fromNewerLibrary = {
  id: 'contact-42',
  fullName: 'Ada Lovelace',
  firstName: 'Ada',
  middleName: 'Augusta',
  lastName: 'Lovelace',
  namePrefix: 'Countess',
  company: 'Analytical Engines',
  jobTitle: 'Mathematician',
  phones: [
    { label: 'MOBILE', number: '+1 555-0100', id: 'phone-7' },
    // This library's `number` is optional, so an entry can carry nothing.
    { label: 'home', id: 'phone-8' }
  ],
  emails: [{ label: 'Work', address: 'ada@example.com', id: 'email-3' }],
  addresses: [
    {
      label: 'HOME',
      street: '1 Engine Way',
      city: 'London',
      region: 'Greater London',
      state: 'NY-if-only-region-were-missing',
      postcode: 'N1',
      country: 'UK',
      id: 'address-2'
    }
  ],
  urlAddresses: [{ label: 'blog', url: 'https://ada.example' }],
  // Also 1-indexed; an adapter whose source used the 0-indexed JS `Date`
  // convention would have to add 1 here.
  birthday: { day: 10, month: 12, year: 1815 },
  isFavourite: true,
  note: 'met at a conference'
}

/** Maps the older library's contact onto `ContactInput`. */
function adaptOlderLibrary(source: typeof fromOlderLibrary): ContactInput {
  return {
    nativeId: source.recordID,
    displayName: source.displayName,
    givenName: source.givenName,
    middleName: source.middleName,
    familyName: source.familyName,
    prefix: source.prefix,
    organization: source.company,
    jobTitle: source.jobTitle,
    phoneNumbers: source.phoneNumbers,
    emailAddresses: source.emailAddresses,
    postalAddresses: source.postalAddresses.map(a => ({
      label: a.label,
      street: a.street,
      city: a.city,
      region: a.state,
      postalCode: a.postCode,
      country: a.country
    })),
    urlAddresses: source.urlAddresses,
    birthday: source.birthday,
    isStarred: source.isStarred,
    note: source.note
  }
}

/** Maps the newer library's contact onto `ContactInput`. */
function adaptNewerLibrary(source: typeof fromNewerLibrary): ContactInput {
  return {
    nativeId: source.id,
    displayName: source.fullName,
    givenName: source.firstName,
    middleName: source.middleName,
    familyName: source.lastName,
    prefix: source.namePrefix,
    organization: source.company,
    jobTitle: source.jobTitle,
    phoneNumbers: source.phones,
    emailAddresses: source.emails.map(e => ({
      label: e.label,
      email: e.address,
      id: e.id
    })),
    postalAddresses: source.addresses.map(a => ({
      label: a.label,
      street: a.street,
      city: a.city,
      // The subdivision is carried as `region` only; this source populates
      // both, so the adapter picks one.
      region: a.region ?? a.state,
      postalCode: a.postcode,
      country: a.country
    })),
    urlAddresses: source.urlAddresses,
    birthday: source.birthday,
    isStarred: source.isFavourite,
    note: source.note
  }
}

/** The `ContactData` both import paths are expected to normalize to. */
const expected = {
  nativeId: 'contact-42',
  displayName: 'Ada Lovelace',
  givenName: 'Ada',
  middleName: 'Augusta',
  familyName: 'Lovelace',
  prefix: 'Countess',
  organization: 'Analytical Engines',
  jobTitle: 'Mathematician',
  phoneNumbers: [{ label: 'mobile', number: '+1 555-0100' }],
  emailAddresses: [{ label: 'work', email: 'ada@example.com' }],
  note: 'met at a conference',
  postalAddresses: [
    {
      label: 'home',
      street: '1 Engine Way',
      city: 'London',
      region: 'Greater London',
      postalCode: 'N1',
      country: 'UK'
    }
  ],
  urlAddresses: [{ label: 'blog', url: 'https://ada.example' }],
  birthday: { day: 10, month: 12, year: 1815 },
  isStarred: true
}

/** Drops the per-entry ids one source supplies and the other does not. */
function withoutSubRecordIds(contact: ContactData | null): unknown {
  const serialized = JSON.parse(JSON.stringify(contact)) as {
    phoneNumbers: Record<string, unknown>[]
    emailAddresses: Record<string, unknown>[]
  }
  for (const entry of [
    ...serialized.phoneNumbers,
    ...serialized.emailAddresses
  ]) {
    delete entry.id
  }
  return serialized
}

describe('cross-library normalization equivalence', () => {
  it('normalizes the older library import to the current shape', () => {
    const data = normalizeContact(adaptOlderLibrary(fromOlderLibrary))
    expect(JSON.parse(JSON.stringify(data))).toEqual(expected)
  })

  it('normalizes the newer library import to the same contact', () => {
    const data = normalizeContact(adaptNewerLibrary(fromNewerLibrary))
    expect(withoutSubRecordIds(data)).toEqual(expected)
  })

  it('serializes both imports identically once the ids are set aside', () => {
    const fromOlder = normalizeContact(adaptOlderLibrary(fromOlderLibrary))
    const fromNewer = normalizeContact(adaptNewerLibrary(fromNewerLibrary))
    expect(JSON.stringify(withoutSubRecordIds(fromNewer))).toBe(
      JSON.stringify(withoutSubRecordIds(fromOlder))
    )
    // The older source has nothing to put in the id fields, so its output
    // carries none at all.
    expect(JSON.stringify(fromOlder)).toBe(JSON.stringify(expected))
  })

  it('carries the per-entry ids the newer source supplies, and drops its empty phone entry', () => {
    const data = normalizeContact(adaptNewerLibrary(fromNewerLibrary))
    expect(data?.phoneNumbers).toEqual([
      { label: 'mobile', number: '+1 555-0100', id: 'phone-7' }
    ])
    expect(data?.emailAddresses).toEqual([
      { label: 'work', email: 'ada@example.com', id: 'email-3' }
    ])
  })

  it('upgrades the stored pre-change document to the same contact', () => {
    // What the older import path stored before the shape change: `postCode`
    // and a separate `state`, no `region`.
    const stored = {
      ...expected,
      postalAddresses: [
        {
          label: 'home',
          street: '1 Engine Way',
          city: 'London',
          state: 'Greater London',
          postCode: 'N1',
          country: 'UK'
        }
      ]
    } as unknown as ContactData

    const upgraded = upgradeContactData(stored)
    expect(JSON.parse(JSON.stringify(upgraded))).toEqual(expected)
    // Post-upgrade the stored document serializes exactly like a fresh
    // import (minus the sub-record ids the older source never had), so
    // last-write-wins sees no spurious edit.
    expect(JSON.stringify(upgraded)).toBe(
      JSON.stringify(
        withoutSubRecordIds(
          normalizeContact(adaptNewerLibrary(fromNewerLibrary))
        )
      )
    )
  })
})
