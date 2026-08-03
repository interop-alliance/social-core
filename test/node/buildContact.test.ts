import { describe, it, expect } from 'vitest'
import { buildContact, getDids } from '../../src/index.js'
import type { ContactData } from '../../src/index.js'

describe('buildContact', () => {
  it('trims the form-bound fields', () => {
    const contact = buildContact({
      displayName: '  Alice Example  ',
      givenName: ' Alice ',
      familyName: ' Example ',
      organization: '  Interop Alliance ',
      note: '  Met at a conference. '
    })
    expect(contact).toMatchObject({
      displayName: 'Alice Example',
      givenName: 'Alice',
      familyName: 'Example',
      organization: 'Interop Alliance',
      note: 'Met at a conference.'
    })
  })

  it('falls back to given + family name for the display name', () => {
    const contact = buildContact({ givenName: 'Alice', familyName: 'Example' })
    expect(contact.displayName).toBe('Alice Example')
  })

  it('leaves the display name empty when nothing was entered', () => {
    expect(buildContact({}).displayName).toBe('')
  })

  it('clears an emptied field to undefined rather than a blank string', () => {
    const existing: ContactData = {
      displayName: 'Alice Example',
      organization: 'Interop Alliance',
      note: 'Met at a conference.'
    }
    const contact = buildContact({ existing, displayName: 'Alice Example' })
    expect(contact.organization).toBeUndefined()
    expect(contact.note).toBeUndefined()
  })

  it('carries through every field the form does not surface', () => {
    const existing: ContactData = {
      nativeId: 'native-1',
      displayName: 'Alice Example',
      middleName: 'Beatrice',
      prefix: 'Dr',
      jobTitle: 'Architect',
      birthday: { day: 3, month: 4 },
      isStarred: true
    }
    const contact = buildContact({ existing, displayName: 'Alice Example' })
    expect(contact).toMatchObject({
      nativeId: 'native-1',
      middleName: 'Beatrice',
      prefix: 'Dr',
      jobTitle: 'Architect',
      birthday: { day: 3, month: 4 },
      isStarred: true
    })
  })

  it('normalizes labels and drops blank rows', () => {
    const contact = buildContact({
      displayName: 'Alice Example',
      phoneNumbers: [
        { label: 'Mobile', value: ' 555-1234 ' },
        { label: 'work', value: '   ' },
        { label: '', value: '555-9999' }
      ],
      emailAddresses: [
        { label: 'WORK', value: ' alice@example.com ' },
        { label: 'home', value: '' }
      ]
    })
    expect(contact.phoneNumbers).toEqual([
      { label: 'mobile', number: '555-1234' },
      { label: 'other', number: '555-9999' }
    ])
    expect(contact.emailAddresses).toEqual([
      { label: 'work', email: 'alice@example.com' }
    ])
  })

  it('emits carried-through entry metadata only when present', () => {
    const contact = buildContact({
      displayName: 'Alice Example',
      phoneNumbers: [
        {
          label: 'mobile',
          value: '555-1234',
          digits: '5551234',
          countryCode: 'us',
          id: 'phone-1'
        },
        { label: 'work', value: '555-9999' }
      ],
      emailAddresses: [
        { label: 'work', value: 'alice@example.com', id: 'email-1' }
      ]
    })
    expect(contact.phoneNumbers?.[0]).toEqual({
      label: 'mobile',
      number: '555-1234',
      digits: '5551234',
      countryCode: 'us',
      id: 'phone-1'
    })
    expect(Object.keys(contact.phoneNumbers?.[1] ?? {})).toEqual([
      'label',
      'number'
    ])
    expect(contact.emailAddresses?.[0].id).toBe('email-1')
  })

  it('folds the DID rows in, deduped and blank-free', () => {
    const contact = buildContact({
      displayName: 'Alice Example',
      dids: [' did:web:example.com ', 'did:web:example.com', '', 'did:key:z6']
    })
    expect(getDids(contact)).toEqual(['did:web:example.com', 'did:key:z6'])
  })

  it('carries non-DID url entries through untouched', () => {
    const existing: ContactData = {
      displayName: 'Alice Example',
      urlAddresses: [
        { label: 'homepage', url: 'https://example.com/alice' },
        { label: 'did', url: 'did:web:old.example' }
      ]
    }
    const contact = buildContact({
      existing,
      displayName: 'Alice Example',
      dids: ['did:web:example.com']
    })
    expect(contact.urlAddresses).toEqual([
      { label: 'homepage', url: 'https://example.com/alice' },
      { label: 'did', url: 'did:web:example.com' }
    ])
  })

  it('omits urlAddresses entirely when nothing is left', () => {
    const existing: ContactData = {
      displayName: 'Alice Example',
      urlAddresses: [{ label: 'did', url: 'did:web:old.example' }]
    }
    const contact = buildContact({ existing, displayName: 'Alice Example' })
    expect(contact.urlAddresses).toBeUndefined()
  })

  it('does not reject a DID row the read side would not surface', () => {
    const contact = buildContact({
      displayName: 'Alice Example',
      dids: ['not-a-did']
    })
    expect(contact.urlAddresses).toEqual([{ label: 'did', url: 'not-a-did' }])
  })
})
