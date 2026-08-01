import { describe, it, expect } from 'vitest'
import { getDids, setDids, unmangleDidUrl } from '../../src/index.js'
import type { ContactData } from '../../src/index.js'

function contactWithUrls(
  urlAddresses?: { label: string; url: string }[]
): ContactData {
  return {
    displayName: 'Alice Example',
    phoneNumbers: [],
    emailAddresses: [],
    ...(urlAddresses ? { urlAddresses } : {})
  }
}

describe('unmangleDidUrl', () => {
  it('strips an http:// prefix from a mangled did: URI', () => {
    expect(unmangleDidUrl('http://did:example:123')).toBe('did:example:123')
  })

  it('strips an https:// prefix from a mangled did: URI', () => {
    expect(unmangleDidUrl('https://did:example:123')).toBe('did:example:123')
  })

  it('strips a case-insensitive scheme prefix', () => {
    expect(unmangleDidUrl('HTTP://did:example:123')).toBe('did:example:123')
  })

  it('leaves an unmangled did: URI unchanged', () => {
    expect(unmangleDidUrl('did:example:123')).toBe('did:example:123')
  })

  it('leaves an ordinary web url unchanged', () => {
    expect(unmangleDidUrl('https://example.com/')).toBe('https://example.com/')
  })
})

describe('getDids', () => {
  it('returns the did: entries, matching on scheme rather than label', () => {
    const contact = contactWithUrls([
      { label: 'homepage', url: 'https://example.com/' },
      { label: 'other', url: 'did:example:123' },
      {
        label: 'did',
        url: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
      }
    ])
    expect(getDids(contact)).toEqual([
      'did:example:123',
      'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
    ])
  })

  it('includes DID URLs carrying a path, query, or fragment', () => {
    const contact = contactWithUrls([
      { label: 'did', url: 'did:example:123#key-2' },
      { label: 'did', url: 'did:example:123?service=files' }
    ])
    expect(getDids(contact)).toEqual([
      'did:example:123#key-2',
      'did:example:123?service=files'
    ])
  })

  it('tolerates the http:// prefix a contacts app may prepend on edit', () => {
    const contact = contactWithUrls([
      { label: 'did', url: 'http://did:example:123' }
    ])
    expect(getDids(contact)).toEqual(['did:example:123'])
  })

  it('trims surrounding whitespace before matching', () => {
    const contact = contactWithUrls([
      { label: 'did', url: ' did:example:123 ' }
    ])
    expect(getDids(contact)).toEqual(['did:example:123'])
  })

  it('does not match an uppercase DID: scheme (DID Core requires lowercase)', () => {
    const contact = contactWithUrls([{ label: 'did', url: 'DID:example:123' }])
    expect(getDids(contact)).toEqual([])
  })

  it('returns [] when urlAddresses is absent or has no did: entries', () => {
    expect(getDids(contactWithUrls())).toEqual([])
    expect(
      getDids(contactWithUrls([{ label: 'work', url: 'https://example.com' }]))
    ).toEqual([])
  })

  it('collapses repeated DIDs to the first occurrence', () => {
    const contact = contactWithUrls([
      { label: 'did', url: 'did:example:123' },
      { label: 'other', url: 'http://did:example:123' },
      { label: 'did', url: 'did:example:456' }
    ])
    expect(getDids(contact)).toEqual(['did:example:123', 'did:example:456'])
  })
})

describe('setDids', () => {
  it('replaces the did: entries with the given list, labeled did', () => {
    const contact = contactWithUrls([
      { label: 'homepage', url: 'https://example.com/' },
      { label: 'other', url: 'did:example:old' }
    ])
    expect(setDids(contact, ['did:example:new']).urlAddresses).toEqual([
      { label: 'homepage', url: 'https://example.com/' },
      { label: 'did', url: 'did:example:new' }
    ])
  })

  it('trims entries and drops blank ones', () => {
    const contact = contactWithUrls()
    expect(
      setDids(contact, [' did:example:123 ', '', '  ']).urlAddresses
    ).toEqual([{ label: 'did', url: 'did:example:123' }])
  })

  it('dedupes exactly, first occurrence winning', () => {
    const contact = contactWithUrls()
    expect(
      setDids(contact, [
        'did:example:123',
        'did:example:123',
        'did:example:456'
      ]).urlAddresses
    ).toEqual([
      { label: 'did', url: 'did:example:123' },
      { label: 'did', url: 'did:example:456' }
    ])
  })

  it('removes a mangled http:// DID entry when replacing', () => {
    const contact = contactWithUrls([
      { label: 'did', url: 'http://did:example:123' }
    ])
    expect(setDids(contact, []).urlAddresses).toBeUndefined()
  })

  it('omits urlAddresses entirely when nothing remains', () => {
    const result = setDids(contactWithUrls(), [])
    expect(result.urlAddresses).toBeUndefined()
    expect(JSON.parse(JSON.stringify(result))).not.toHaveProperty(
      'urlAddresses'
    )
  })

  it('does not mutate the input contact', () => {
    const contact = contactWithUrls([{ label: 'did', url: 'did:example:old' }])
    setDids(contact, ['did:example:new'])
    expect(contact.urlAddresses).toEqual([
      { label: 'did', url: 'did:example:old' }
    ])
  })
})
