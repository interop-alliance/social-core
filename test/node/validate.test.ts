import { describe, it, expect } from 'vitest'
import {
  isContactData,
  isContactHeadPayload,
  isContactRevisionPayload
} from '../../src/index.js'
import type {
  ContactData,
  ContactHeadPayload,
  ContactRevisionPayload
} from '../../src/index.js'

const validContact: ContactData = {
  nativeId: 'phone-1',
  displayName: 'Ada Lovelace',
  givenName: 'Ada',
  familyName: 'Lovelace',
  organization: 'Analytical Engines',
  phoneNumbers: [{ label: 'mobile', number: '555-0100' }],
  emailAddresses: [{ label: 'work', email: 'ada@example.com' }],
  note: 'met at a conference'
}

const validHead: ContactHeadPayload = {
  contactId: 'row-1',
  updatedAt: '2026-07-06T00:00:05.000Z',
  deviceId: 'device-A',
  contact: validContact
}

const validRevision: ContactRevisionPayload = {
  contactId: 'row-1',
  action: 'update',
  timestamp: '2026-07-06T00:00:05.000Z',
  deviceId: 'device-A',
  snapshot: validContact
}

describe('isContactData', () => {
  it('accepts a full valid contact', () => {
    expect(isContactData(validContact)).toBe(true)
  })

  it('accepts a minimal contact (no optional fields, empty arrays)', () => {
    expect(
      isContactData({ displayName: '', phoneNumbers: [], emailAddresses: [] })
    ).toBe(true)
  })

  it('accepts a null nativeId (wallet-created)', () => {
    expect(isContactData({ ...validContact, nativeId: null })).toBe(true)
  })

  it('rejects non-objects', () => {
    expect(isContactData(null)).toBe(false)
    expect(isContactData(undefined)).toBe(false)
    expect(isContactData('contact')).toBe(false)
    expect(isContactData(42)).toBe(false)
  })

  it('rejects a missing/non-string displayName', () => {
    expect(isContactData({ phoneNumbers: [], emailAddresses: [] })).toBe(false)
    expect(
      isContactData({ displayName: 5, phoneNumbers: [], emailAddresses: [] })
    ).toBe(false)
  })

  it('rejects malformed phoneNumbers / emailAddresses', () => {
    expect(
      isContactData({
        displayName: 'X',
        phoneNumbers: [{ label: 'home' }],
        emailAddresses: []
      })
    ).toBe(false)
    expect(
      isContactData({
        displayName: 'X',
        phoneNumbers: [],
        emailAddresses: [{ label: 'home', email: 5 }]
      })
    ).toBe(false)
    expect(
      isContactData({
        displayName: 'X',
        phoneNumbers: 'nope',
        emailAddresses: []
      })
    ).toBe(false)
  })

  it('rejects a wrong-typed optional field', () => {
    expect(isContactData({ ...validContact, organization: 5 })).toBe(false)
  })

  it('accepts a contact with every extended field populated', () => {
    expect(
      isContactData({
        ...validContact,
        middleName: 'Augusta',
        prefix: 'Countess',
        suffix: 'Jr.',
        jobTitle: 'Mathematician',
        department: 'Research',
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
        imAddresses: [{ service: 'Signal', username: 'ada.l' }],
        urlAddresses: [{ label: 'blog', url: 'https://ada.example' }],
        birthday: { day: 10, month: 12, year: 1815 },
        isStarred: true
      })
    ).toBe(true)
  })

  it('accepts a postal address with only a label, and a birthday without a year', () => {
    expect(
      isContactData({
        ...validContact,
        postalAddresses: [{ label: 'other' }],
        birthday: { day: 1, month: 6 }
      })
    ).toBe(true)
  })

  it('rejects wrong-typed extended scalar fields', () => {
    expect(isContactData({ ...validContact, middleName: 5 })).toBe(false)
    expect(isContactData({ ...validContact, jobTitle: [] })).toBe(false)
    expect(isContactData({ ...validContact, isStarred: 'yes' })).toBe(false)
  })

  it('rejects malformed extended array elements', () => {
    expect(
      isContactData({ ...validContact, postalAddresses: [{ street: 'x' }] })
    ).toBe(false)
    expect(
      isContactData({
        ...validContact,
        postalAddresses: [{ label: 'home', city: 5 }]
      })
    ).toBe(false)
    expect(
      isContactData({ ...validContact, imAddresses: [{ service: 'Signal' }] })
    ).toBe(false)
    expect(
      isContactData({
        ...validContact,
        urlAddresses: [{ label: 'blog', url: 5 }]
      })
    ).toBe(false)
    expect(isContactData({ ...validContact, imAddresses: 'nope' })).toBe(false)
  })

  it('accepts the richer phone/email sub-record fields', () => {
    expect(
      isContactData({
        ...validContact,
        phoneNumbers: [
          {
            label: 'mobile',
            number: '555-0100',
            digits: '5550100',
            countryCode: 'us',
            id: 'phone-1'
          }
        ],
        emailAddresses: [
          { label: 'work', email: 'ada@example.com', id: 'email-1' }
        ]
      })
    ).toBe(true)
  })

  it('rejects wrong-typed phone/email sub-record fields', () => {
    expect(
      isContactData({
        ...validContact,
        phoneNumbers: [{ label: 'mobile', number: '555-0100', digits: 5 }]
      })
    ).toBe(false)
    expect(
      isContactData({
        ...validContact,
        emailAddresses: [{ label: 'work', email: 'a@b.io', id: 7 }]
      })
    ).toBe(false)
  })

  it('still accepts a document stored under the legacy postal spellings', () => {
    // Consumers decrypt, validate, then upgrade; the guard must not reject a
    // pre-upgrade document.
    expect(
      isContactData({
        ...validContact,
        postalAddresses: [
          {
            label: 'home',
            pobox: 'PO Box 1',
            state: 'NY',
            postCode: '10001'
          }
        ]
      })
    ).toBe(true)
  })

  it('rejects a malformed birthday (missing or non-numeric day/month)', () => {
    expect(isContactData({ ...validContact, birthday: { month: 6 } })).toBe(
      false
    )
    expect(
      isContactData({ ...validContact, birthday: { day: '10', month: 6 } })
    ).toBe(false)
    expect(
      isContactData({
        ...validContact,
        birthday: { day: 10, month: 6, year: '1815' }
      })
    ).toBe(false)
  })
})

describe('isContactHeadPayload', () => {
  it('accepts a valid head payload', () => {
    expect(isContactHeadPayload(validHead)).toBe(true)
  })

  it('rejects a missing field', () => {
    const { deviceId: _deviceId, ...rest } = validHead
    void _deviceId
    expect(isContactHeadPayload(rest)).toBe(false)
  })

  it('rejects a non-string updatedAt', () => {
    expect(isContactHeadPayload({ ...validHead, updatedAt: 1720000000 })).toBe(
      false
    )
  })

  it('rejects an invalid nested contact', () => {
    expect(
      isContactHeadPayload({ ...validHead, contact: { displayName: 5 } })
    ).toBe(false)
  })
})

describe('isContactRevisionPayload', () => {
  it('accepts every valid action', () => {
    for (const action of ['create', 'update', 'delete', 'restore'] as const) {
      expect(isContactRevisionPayload({ ...validRevision, action })).toBe(true)
    }
  })

  it('rejects an unknown action', () => {
    expect(
      isContactRevisionPayload({ ...validRevision, action: 'merge' })
    ).toBe(false)
  })

  it('rejects a missing snapshot', () => {
    const { snapshot: _snapshot, ...rest } = validRevision
    void _snapshot
    expect(isContactRevisionPayload(rest)).toBe(false)
  })

  it('rejects a non-string timestamp', () => {
    expect(isContactRevisionPayload({ ...validRevision, timestamp: 123 })).toBe(
      false
    )
  })
})
