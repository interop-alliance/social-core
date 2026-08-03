import { describe, it, expect } from 'vitest'
import {
  SELF_CONTACT_NAME,
  getDids,
  isUnlinkedSeedTwin,
  selfContact
} from '../../src/index.js'
import type { ContactData } from '../../src/index.js'

describe('SELF_CONTACT_NAME', () => {
  it('is the exact string every wallet seeds the self-contact under', () => {
    expect(SELF_CONTACT_NAME).toBe('You (this user)')
  })

  it('names the seed selfContact produces', () => {
    expect(selfContact({}).displayName).toBe(SELF_CONTACT_NAME)
  })
})

describe('selfContact', () => {
  it('omits DIDs and email when neither is supplied', () => {
    const seed = selfContact({})
    expect(seed.displayName).toBe('You (this user)')
    expect(seed.urlAddresses).toBeUndefined()
    expect(seed.emailAddresses).toEqual([])
  })

  it('is normalized (empty phone / email arrays present)', () => {
    const seed = selfContact({})
    expect(seed.phoneNumbers).toEqual([])
    expect(seed.emailAddresses).toEqual([])
  })

  it('carries every DID supplied, in order', () => {
    const seed = selfContact({
      dids: ['did:web:example.com', 'did:webvh:example.com:abc']
    })
    expect(getDids(seed)).toEqual([
      'did:web:example.com',
      'did:webvh:example.com:abc'
    ])
    expect(seed.urlAddresses?.every(entry => entry.label === 'did')).toBe(true)
  })

  it('carries the email under the normalized fallback label', () => {
    const seed = selfContact({ email: 'alice@example.com' })
    expect(seed.emailAddresses).toEqual([
      { label: 'other', email: 'alice@example.com', id: undefined }
    ])
  })

  it('is stable across calls with the same arguments', () => {
    expect(selfContact({ dids: ['did:web:example.com'] })).toEqual(
      selfContact({ dids: ['did:web:example.com'] })
    )
  })
})

describe('isUnlinkedSeedTwin', () => {
  const seedNames = [SELF_CONTACT_NAME, 'Support Desk']

  function seedRow(overrides: Partial<ContactData> = {}): ContactData {
    return {
      displayName: SELF_CONTACT_NAME,
      phoneNumbers: [],
      emailAddresses: [],
      ...overrides
    }
  }

  it('absorbs an untouched local twin of a pulled seed', () => {
    expect(isUnlinkedSeedTwin(seedRow(), seedRow(), seedNames)).toBe(true)
  })

  it('absorbs a twin that differs only in its DIDs', () => {
    const incoming = seedRow({
      urlAddresses: [{ label: 'did', url: 'did:web:example.com' }]
    })
    expect(isUnlinkedSeedTwin(seedRow(), incoming, seedNames)).toBe(true)
  })

  it("absorbs a twin of a caller's own app-side seed", () => {
    const local = seedRow({ displayName: 'Support Desk' })
    const incoming = seedRow({ displayName: 'Support Desk' })
    expect(isUnlinkedSeedTwin(local, incoming, seedNames)).toBe(true)
  })

  it('refuses when the incoming contact is not a named seed', () => {
    const incoming = seedRow({ displayName: 'Alice Example' })
    const local = seedRow({ displayName: 'Alice Example' })
    expect(isUnlinkedSeedTwin(local, incoming, seedNames)).toBe(false)
  })

  it('refuses when the caller lists no seed names', () => {
    expect(isUnlinkedSeedTwin(seedRow(), seedRow(), [])).toBe(false)
  })

  it('refuses when the names differ', () => {
    const local = seedRow({ displayName: 'Support Desk' })
    expect(isUnlinkedSeedTwin(local, seedRow(), seedNames)).toBe(false)
  })

  it('refuses a local row the user grew a phone number on', () => {
    const local = seedRow({
      phoneNumbers: [{ label: 'mobile', number: '555-1234' }]
    })
    expect(isUnlinkedSeedTwin(local, seedRow(), seedNames)).toBe(false)
  })

  it('refuses a local row the user grew an email on', () => {
    const local = seedRow({
      emailAddresses: [{ label: 'other', email: 'alice@example.com' }]
    })
    expect(isUnlinkedSeedTwin(local, seedRow(), seedNames)).toBe(false)
  })

  it('refuses a local row the user grew an organization on', () => {
    const local = seedRow({ organization: 'Example Org' })
    expect(isUnlinkedSeedTwin(local, seedRow(), seedNames)).toBe(false)
  })

  it('refuses a local row the user grew a note on', () => {
    const local = seedRow({ note: 'Met at a conference.' })
    expect(isUnlinkedSeedTwin(local, seedRow(), seedNames)).toBe(false)
  })

  it('tolerates a local row with the phone / email fields absent', () => {
    const local: ContactData = { displayName: SELF_CONTACT_NAME }
    expect(isUnlinkedSeedTwin(local, seedRow(), seedNames)).toBe(true)
  })
})
