import { describe, it, expect } from 'vitest'
import { normalizeContact, normalizeLabel } from '../../src/index.js'

describe('normalizeLabel', () => {
  it('lowercases and trims a label', () => {
    expect(normalizeLabel('HOME')).toBe('home')
    expect(normalizeLabel('  Work  ')).toBe('work')
  })

  it('falls back to "other" for empty, null, or undefined', () => {
    expect(normalizeLabel('')).toBe('other')
    expect(normalizeLabel('   ')).toBe('other')
    expect(normalizeLabel(null)).toBe('other')
    expect(normalizeLabel(undefined)).toBe('other')
  })
})

describe('normalizeContact', () => {
  it('maps nativeId and passes organization/note through', () => {
    const data = normalizeContact({
      nativeId: 'abc-123',
      givenName: 'Ada',
      familyName: 'Lovelace',
      organization: 'Analytical Engines',
      note: 'met at a conference'
    })
    expect(data).not.toBeNull()
    expect(data).toMatchObject({
      nativeId: 'abc-123',
      displayName: 'Ada Lovelace',
      givenName: 'Ada',
      familyName: 'Lovelace',
      organization: 'Analytical Engines',
      note: 'met at a conference'
    })
  })

  it('falls back the display name to given+family (here just given)', () => {
    const data = normalizeContact({
      givenName: 'Grace',
      familyName: '',
      phoneNumbers: [{ label: 'mobile', number: '555-0100' }]
    })
    expect(data).not.toBeNull()
    expect(data?.displayName).toBe('Grace')
    expect(data?.phoneNumbers).toEqual([
      { label: 'mobile', number: '555-0100' }
    ])
  })

  it('prefers the provided displayName over the given+family fallback', () => {
    const data = normalizeContact({
      displayName: 'DJ Spooky',
      givenName: 'Paul',
      familyName: 'Miller'
    })
    expect(data?.displayName).toBe('DJ Spooky')
  })

  it('returns null for an entry with no name AND no phone/email', () => {
    expect(
      normalizeContact({ givenName: '  ', familyName: '', organization: '' })
    ).toBeNull()
  })

  it('keeps an entry that has only an email and no name', () => {
    const data = normalizeContact({
      emailAddresses: [{ label: 'work', email: 'x@example.com' }]
    })
    expect(data).not.toBeNull()
    expect(data?.displayName).toBe('')
    expect(data?.emailAddresses).toEqual([
      { label: 'work', email: 'x@example.com' }
    ])
  })

  it('normalizes label casing and falls back an empty label to "other"', () => {
    const data = normalizeContact({
      givenName: 'Labels',
      phoneNumbers: [
        { label: 'HOME', number: '1' },
        { label: '  Work  ', number: '2' },
        { label: '', number: '3' }
      ],
      emailAddresses: [{ label: undefined, email: 'e@x.io' }]
    })
    expect(data?.phoneNumbers.map(p => p.label)).toEqual([
      'home',
      'work',
      'other'
    ])
    expect(data?.emailAddresses[0]?.label).toBe('other')
  })

  it('omits optional string fields that are empty rather than storing ""', () => {
    const data = normalizeContact({
      givenName: 'Solo',
      familyName: '',
      organization: '  '
    })
    expect(data?.givenName).toBe('Solo')
    expect(data?.familyName).toBeUndefined()
    expect(data?.organization).toBeUndefined()
    expect(data?.note).toBeUndefined()
  })

  it('serializes exactly the pre-expansion keys when no new fields are set (JSON round-trip regression)', () => {
    // A contact with none of the new fields must serialize byte-identically to
    // what the pre-expansion implementation produced: no new keys, not even
    // with undefined values, may appear after a JSON round-trip.
    const data = normalizeContact({
      nativeId: 'abc-123',
      givenName: 'Ada',
      familyName: 'Lovelace',
      organization: 'Analytical Engines',
      phoneNumbers: [{ label: 'HOME', number: '555-0100' }],
      note: 'met at a conference'
    })
    expect(JSON.parse(JSON.stringify(data))).toEqual({
      nativeId: 'abc-123',
      displayName: 'Ada Lovelace',
      givenName: 'Ada',
      familyName: 'Lovelace',
      organization: 'Analytical Engines',
      phoneNumbers: [{ label: 'home', number: '555-0100' }],
      emailAddresses: [],
      note: 'met at a conference'
    })
  })

  it('round-trips every extended field', () => {
    const data = normalizeContact({
      nativeId: 'full-1',
      givenName: 'Ada',
      middleName: ' Augusta ',
      familyName: 'Lovelace',
      prefix: 'Countess',
      suffix: ' Jr. ',
      organization: 'Analytical Engines',
      jobTitle: ' Mathematician ',
      department: 'Research',
      phoneNumbers: [{ label: 'mobile', number: '555-0100' }],
      postalAddresses: [
        {
          label: 'HOME',
          formattedAddress: ' 1 Engine Way, London ',
          street: '1 Engine Way',
          city: 'London',
          region: ' Greater London ',
          postalCode: 'N1',
          country: 'UK'
        }
      ],
      imAddresses: [{ service: ' Signal ', username: ' ada.l ' }],
      urlAddresses: [{ label: ' Blog ', url: ' https://ada.example ' }],
      birthday: { day: 10, month: 12, year: 1815 },
      isStarred: true
    })
    expect(data).toMatchObject({
      middleName: 'Augusta',
      prefix: 'Countess',
      suffix: 'Jr.',
      jobTitle: 'Mathematician',
      department: 'Research',
      postalAddresses: [
        {
          label: 'home',
          formattedAddress: '1 Engine Way, London',
          street: '1 Engine Way',
          city: 'London',
          region: 'Greater London',
          postalCode: 'N1',
          country: 'UK'
        }
      ],
      imAddresses: [{ service: 'Signal', username: 'ada.l' }],
      urlAddresses: [{ label: 'blog', url: 'https://ada.example' }],
      birthday: { day: 10, month: 12, year: 1815 },
      isStarred: true
    })
    // Empty postal subfields are omitted, not stored as ''.
    expect(data?.postalAddresses?.[0]?.poBox).toBeUndefined()
    expect(data?.postalAddresses?.[0]?.neighborhood).toBeUndefined()
  })

  it('omits the new array fields entirely when empty or absent', () => {
    const data = normalizeContact({
      givenName: 'Sparse',
      postalAddresses: [],
      imAddresses: null,
      urlAddresses: undefined
    })
    expect(data).not.toBeNull()
    expect(Object.keys(JSON.parse(JSON.stringify(data)))).not.toContain(
      'postalAddresses'
    )
    expect('imAddresses' in (data as object)).toBe(false)
    expect('urlAddresses' in (data as object)).toBe(false)
  })

  it('drops IM entries with an empty username and URL entries with an empty url', () => {
    const data = normalizeContact({
      givenName: 'Filter',
      imAddresses: [
        { service: 'Signal', username: '   ' },
        { service: 'IRC', username: 'filter' }
      ],
      urlAddresses: [
        { label: 'home', url: '' },
        { label: 'work', url: 'https://x.example' }
      ]
    })
    expect(data?.imAddresses).toEqual([{ service: 'IRC', username: 'filter' }])
    expect(data?.urlAddresses).toEqual([
      { label: 'work', url: 'https://x.example' }
    ])
  })

  it('unmangles http(s)://-prefixed did: URLs, leaving web urls alone', () => {
    const data = normalizeContact({
      givenName: 'Didi',
      urlAddresses: [
        { label: 'did', url: 'http://did:example:123' },
        { label: 'work', url: 'https://x.example' }
      ]
    })
    expect(data?.urlAddresses).toEqual([
      { label: 'did', url: 'did:example:123' },
      { label: 'work', url: 'https://x.example' }
    ])
  })

  it('omits imAddresses/urlAddresses when every entry is dropped', () => {
    const data = normalizeContact({
      givenName: 'AllDropped',
      imAddresses: [{ service: 'Signal', username: '' }],
      urlAddresses: [{ label: 'home', url: '  ' }]
    })
    expect('imAddresses' in (data as object)).toBe(false)
    expect('urlAddresses' in (data as object)).toBe(false)
  })

  it('carries a birthday without a year, and drops an implausible one', () => {
    const noYear = normalizeContact({
      givenName: 'B',
      birthday: { day: 1, month: 6 }
    })
    expect(noYear?.birthday).toEqual({ day: 1, month: 6 })

    const invalid = normalizeContact({
      givenName: 'B',
      birthday: { day: 0, month: 6 }
    })
    expect(invalid?.birthday).toBeUndefined()

    const nonFinite = normalizeContact({
      givenName: 'B',
      birthday: { day: NaN, month: 6 }
    })
    expect(nonFinite?.birthday).toBeUndefined()
  })

  it('carries the richer phone/email sub-record fields, trimmed', () => {
    const data = normalizeContact({
      givenName: 'Rich',
      phoneNumbers: [
        {
          label: 'MOBILE',
          number: ' +1 555-0100 ',
          digits: ' 15550100 ',
          countryCode: ' us ',
          id: ' phone-entry-1 '
        }
      ],
      emailAddresses: [
        { label: 'work', email: ' rich@example.com ', id: ' email-entry-1 ' }
      ]
    })
    expect(data?.phoneNumbers).toEqual([
      {
        label: 'mobile',
        number: '+1 555-0100',
        digits: '15550100',
        countryCode: 'us',
        id: 'phone-entry-1'
      }
    ])
    expect(data?.emailAddresses).toEqual([
      { label: 'work', email: 'rich@example.com', id: 'email-entry-1' }
    ])
  })

  it('omits empty optional sub-record fields rather than storing ""', () => {
    const data = normalizeContact({
      givenName: 'Sparse',
      phoneNumbers: [
        { label: 'home', number: '555-0100', digits: '  ', countryCode: null }
      ],
      emailAddresses: [{ label: 'home', email: 'a@b.io', id: '' }]
    })
    const serialized = JSON.parse(JSON.stringify(data)) as {
      phoneNumbers: object[]
      emailAddresses: object[]
    }
    expect(serialized.phoneNumbers).toEqual([
      { label: 'home', number: '555-0100' }
    ])
    expect(serialized.emailAddresses).toEqual([
      { label: 'home', email: 'a@b.io' }
    ])
  })

  it('drops phone/email entries that are empty after trimming', () => {
    const data = normalizeContact({
      givenName: 'Filter',
      phoneNumbers: [
        { label: 'home', number: '  ' },
        { label: 'mobile', number: ' 555-0100 ' },
        { label: 'work', number: null }
      ],
      emailAddresses: [
        { label: 'work', email: '' },
        { label: 'home', email: ' a@b.io ' }
      ]
    })
    expect(data?.phoneNumbers).toEqual([
      { label: 'mobile', number: '555-0100' }
    ])
    expect(data?.emailAddresses).toEqual([{ label: 'home', email: 'a@b.io' }])
  })

  it('does not let an empty phone/email entry keep a nameless contact', () => {
    // The empty entries are dropped BEFORE the keep/drop check, so there is
    // no contact method left and nothing worth importing.
    expect(
      normalizeContact({
        phoneNumbers: [{ label: 'home', number: '   ' }],
        emailAddresses: [{ label: 'work', email: '' }]
      })
    ).toBeNull()

    // ... while a real entry still keeps it.
    const kept = normalizeContact({
      phoneNumbers: [
        { label: 'home', number: '' },
        { label: 'mobile', number: '555-0100' }
      ]
    })
    expect(kept?.displayName).toBe('')
    expect(kept?.phoneNumbers).toHaveLength(1)
  })

  it('includes isStarred only when exactly true', () => {
    expect(
      normalizeContact({ givenName: 'S', isStarred: true })?.isStarred
    ).toBe(true)
    expect(
      'isStarred' in
        (normalizeContact({ givenName: 'S', isStarred: false }) as object)
    ).toBe(false)
    expect(
      'isStarred' in (normalizeContact({ givenName: 'S' }) as object)
    ).toBe(false)
  })
})
