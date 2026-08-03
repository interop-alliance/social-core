import { describe, it, expect } from 'vitest'
import {
  ACTION_LABELS,
  compareContactsByName,
  contactMatchesQuery,
  initialsFor,
  secondaryLineFor,
  snapshotLines
} from '../../src/index.js'
import type { ContactData } from '../../src/index.js'

function contact(overrides: Partial<ContactData> = {}): ContactData {
  return {
    displayName: 'Alice Example',
    phoneNumbers: [],
    emailAddresses: [],
    ...overrides
  }
}

describe('initialsFor', () => {
  it('uses the first and last token of a two-token name', () => {
    expect(initialsFor('Alice Example')).toBe('AE')
  })

  it('uses the first and LAST token of a three-token name', () => {
    expect(initialsFor('Alice Beatrice Example')).toBe('AE')
  })

  it('uppercases a lowercase name', () => {
    expect(initialsFor('john doe')).toBe('JD')
  })

  it('collapses runs of whitespace', () => {
    expect(initialsFor('  Alice    Example  ')).toBe('AE')
  })

  it('returns one letter for a single-token name', () => {
    expect(initialsFor('Alice')).toBe('A')
  })

  it('returns ? for an empty name', () => {
    expect(initialsFor('')).toBe('?')
  })

  it('returns ? for a whitespace-only name', () => {
    expect(initialsFor('   ')).toBe('?')
  })
})

describe('secondaryLineFor', () => {
  it('prefers the organization', () => {
    const line = secondaryLineFor(
      contact({
        organization: 'Interop Alliance',
        phoneNumbers: [{ label: 'other', number: '555-1234' }]
      })
    )
    expect(line).toBe('Interop Alliance')
  })

  it('falls back to the first phone number', () => {
    const line = secondaryLineFor(
      contact({
        phoneNumbers: [
          { label: 'mobile', number: '555-1234' },
          { label: 'work', number: '555-9999' }
        ],
        emailAddresses: [{ label: 'other', email: 'alice@example.com' }]
      })
    )
    expect(line).toBe('555-1234')
  })

  it('falls back to the first email address', () => {
    const line = secondaryLineFor(
      contact({
        emailAddresses: [{ label: 'other', email: 'alice@example.com' }]
      })
    )
    expect(line).toBe('alice@example.com')
  })

  it('returns an empty string when there is nothing to show', () => {
    expect(secondaryLineFor(contact())).toBe('')
  })
})

describe('contactMatchesQuery', () => {
  const alice = contact({
    organization: 'Interop Alliance',
    phoneNumbers: [{ label: 'mobile', number: '555-1234' }],
    emailAddresses: [{ label: 'work', email: 'alice@example.com' }],
    urlAddresses: [
      { label: 'did', url: 'https://did:example:123' },
      { label: 'homepage', url: 'https://example.com/alice' }
    ]
  })

  it('matches the display name case-insensitively', () => {
    expect(contactMatchesQuery(alice, 'ALICE')).toBe(true)
  })

  it('matches the organization', () => {
    expect(contactMatchesQuery(alice, 'alliance')).toBe(true)
  })

  it('matches a phone number', () => {
    expect(contactMatchesQuery(alice, '555-12')).toBe(true)
  })

  it('matches an email address', () => {
    expect(contactMatchesQuery(alice, 'example.com')).toBe(true)
  })

  it('matches a DID in its unmangled form', () => {
    expect(contactMatchesQuery(alice, 'did:example:123')).toBe(true)
  })

  it('trims the query', () => {
    expect(contactMatchesQuery(alice, '  alliance  ')).toBe(true)
  })

  it('does not match an unrelated query', () => {
    expect(contactMatchesQuery(alice, 'zebra')).toBe(false)
  })

  it('matches every contact on a blank query', () => {
    expect(contactMatchesQuery(alice, '   ')).toBe(true)
  })
})

describe('compareContactsByName', () => {
  it('orders by display name', () => {
    const names = [
      contact({ displayName: 'Carol' }),
      contact({ displayName: 'alice' }),
      contact({ displayName: 'Bob' })
    ]
      .sort(compareContactsByName)
      .map(({ displayName }) => displayName)
    expect(names).toEqual(['alice', 'Bob', 'Carol'])
  })

  it('returns 0 for equal names', () => {
    expect(compareContactsByName(contact(), contact())).toBe(0)
  })
})

describe('ACTION_LABELS', () => {
  it('labels every contact action', () => {
    expect(ACTION_LABELS).toEqual({
      create: 'Created',
      update: 'Edited',
      delete: 'Deleted',
      restore: 'Restored'
    })
  })
})

describe('snapshotLines', () => {
  it('lists name, organization, entries and note in display order', () => {
    const lines = snapshotLines(
      contact({
        organization: 'Interop Alliance',
        phoneNumbers: [{ label: 'mobile', number: '555-1234' }],
        emailAddresses: [{ label: 'work', email: 'alice@example.com' }],
        urlAddresses: [{ label: 'did', url: 'did:example:123' }],
        note: 'Met at a conference.'
      })
    )
    expect(lines).toEqual([
      'Alice Example',
      'Interop Alliance',
      'mobile: 555-1234',
      'work: alice@example.com',
      'did: did:example:123',
      'Met at a conference.'
    ])
  })

  it('emits only the name for a bare contact', () => {
    expect(snapshotLines(contact())).toEqual(['Alice Example'])
  })
})
