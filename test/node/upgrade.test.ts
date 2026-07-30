import { describe, it, expect } from 'vitest'
import {
  upgradeContactData,
  upgradeContactHeadPayload,
  upgradeContactRevisionPayload
} from '../../src/index.js'
import type {
  ContactData,
  ContactHeadPayload,
  ContactRevisionPayload
} from '../../src/index.js'

/** A stored contact written under the pre-upgrade postal spellings. */
function legacyContact(
  address: Record<string, string>
): ContactData & { postalAddresses: Record<string, string>[] } {
  return {
    displayName: 'Ada Lovelace',
    phoneNumbers: [{ label: 'mobile', number: '555-0100' }],
    emailAddresses: [],
    postalAddresses: [{ label: 'home', ...address }]
  } as ContactData & { postalAddresses: Record<string, string>[] }
}

describe('upgradeContactData', () => {
  it('renames postCode to postalCode and pobox to poBox', () => {
    const upgraded = upgradeContactData(
      legacyContact({ pobox: 'PO Box 1', postCode: '10001' })
    )
    expect(upgraded.postalAddresses?.[0]).toEqual({
      label: 'home',
      poBox: 'PO Box 1',
      postalCode: '10001'
    })
    const stored = JSON.parse(
      JSON.stringify(upgraded.postalAddresses?.[0])
    ) as object
    expect(Object.keys(stored)).not.toContain('pobox')
    expect(Object.keys(stored)).not.toContain('postCode')
  })

  it('folds state into region when region is absent', () => {
    const upgraded = upgradeContactData(legacyContact({ state: 'NY' }))
    expect(upgraded.postalAddresses?.[0]?.region).toBe('NY')
  })

  it('keeps an existing region and still drops state', () => {
    const upgraded = upgradeContactData(
      legacyContact({ region: 'Greater London', state: 'NY' })
    )
    expect(upgraded.postalAddresses?.[0]?.region).toBe('Greater London')
    const stored = JSON.parse(
      JSON.stringify(upgraded.postalAddresses?.[0])
    ) as object
    expect(Object.keys(stored)).not.toContain('state')
  })

  it('passes a current-shape contact through unchanged and is idempotent', () => {
    const current: ContactData = {
      nativeId: 'phone-1',
      displayName: 'Ada Lovelace',
      phoneNumbers: [
        { label: 'mobile', number: '555-0100', digits: '5550100' }
      ],
      emailAddresses: [{ label: 'work', email: 'ada@example.com' }],
      postalAddresses: [
        {
          label: 'home',
          street: '1 Engine Way',
          poBox: 'PO Box 1',
          city: 'London',
          region: 'Greater London',
          postalCode: 'N1',
          country: 'UK'
        }
      ]
    }
    const once = upgradeContactData(current)
    expect(JSON.stringify(once)).toBe(JSON.stringify(current))
    expect(JSON.stringify(upgradeContactData(once))).toBe(JSON.stringify(once))
  })

  it('is idempotent on a legacy contact (second pass is a no-op)', () => {
    const once = upgradeContactData(
      legacyContact({ pobox: 'PO Box 1', state: 'NY', postCode: '10001' })
    )
    expect(JSON.stringify(upgradeContactData(once))).toBe(JSON.stringify(once))
  })

  it('returns a contact without postal addresses untouched', () => {
    const contact: ContactData = {
      displayName: 'Solo',
      phoneNumbers: [],
      emailAddresses: [{ label: 'home', email: 'solo@example.com' }]
    }
    expect(upgradeContactData(contact)).toBe(contact)
  })

  it('upgrades the contact inside a head payload, leaving the rest alone', () => {
    const payload: ContactHeadPayload = {
      contactId: 'row-1',
      updatedAt: '2026-07-06T00:00:05.000Z',
      deviceId: 'device-A',
      contact: legacyContact({ state: 'NY', postCode: '10001' })
    }
    const upgraded = upgradeContactHeadPayload(payload)
    expect(upgraded.contactId).toBe('row-1')
    expect(upgraded.updatedAt).toBe('2026-07-06T00:00:05.000Z')
    expect(upgraded.deviceId).toBe('device-A')
    expect(upgraded.contact.postalAddresses?.[0]).toEqual({
      label: 'home',
      region: 'NY',
      postalCode: '10001'
    })
  })

  it('upgrades the snapshot inside a revision payload', () => {
    const payload: ContactRevisionPayload = {
      contactId: 'row-1',
      action: 'update',
      timestamp: '2026-07-06T00:00:05.000Z',
      deviceId: 'device-A',
      snapshot: legacyContact({ pobox: 'PO Box 1' })
    }
    const upgraded = upgradeContactRevisionPayload(payload)
    expect(upgraded.action).toBe('update')
    expect(upgraded.snapshot.postalAddresses?.[0]?.poBox).toBe('PO Box 1')
  })
})
