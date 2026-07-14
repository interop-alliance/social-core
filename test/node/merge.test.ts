import { describe, it, expect } from 'vitest'
import { planImportMerge } from '../../src/index.js'
import type { ContactData } from '../../src/index.js'

function contact(overrides: Partial<ContactData> = {}): ContactData {
  return {
    nativeId: null,
    displayName: 'Ada Lovelace',
    phoneNumbers: [{ label: 'mobile', number: '555-0100' }],
    emailAddresses: [],
    ...overrides
  }
}

function existingRow(options: {
  _id: string
  contact: ContactData
  createdAt: string
  updatedAt?: string
}) {
  return {
    _id: options._id,
    createdAt: new Date(options.createdAt),
    updatedAt: new Date(options.updatedAt ?? options.createdAt),
    contact: options.contact
  }
}

describe('planImportMerge', () => {
  it('inserts a new contact when no row matches its nativeId', () => {
    const incoming = contact({ nativeId: 'phone-1', displayName: 'New Person' })
    const plan = planImportMerge([], [incoming])
    expect(plan.inserts).toEqual([incoming])
    expect(plan.overwrites).toHaveLength(0)
    expect(plan.skips).toHaveLength(0)
  })

  it('overwrites a never-edited imported row (updatedAt === createdAt)', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({ nativeId: 'phone-1', displayName: 'Old Name' })
    })
    const incoming = contact({ nativeId: 'phone-1', displayName: 'Fresh Name' })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.skips).toHaveLength(0)
    expect(plan.overwrites).toEqual([{ _id: 'c1', contact: incoming }])
  })

  it('skips a wallet-edited row (updatedAt !== createdAt)', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
      contact: contact({ nativeId: 'phone-1', displayName: 'Wallet Edit' })
    })
    const incoming = contact({ nativeId: 'phone-1', displayName: 'Phone Ver' })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.overwrites).toHaveLength(0)
    expect(plan.skips).toEqual([incoming])
  })

  it('never matches a wallet-only existing row (nativeId null): incoming inserts', () => {
    const existing = existingRow({
      _id: 'wallet-only',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({ nativeId: null, displayName: 'Hand Typed' })
    })
    const incoming = contact({ nativeId: 'phone-1', displayName: 'From Phone' })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.inserts).toEqual([incoming])
    expect(plan.overwrites).toHaveLength(0)
    expect(plan.skips).toHaveLength(0)
  })

  it('always inserts an incoming contact whose nativeId is null or undefined', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({ nativeId: 'phone-1', displayName: 'Existing' })
    })
    const nullId = contact({ nativeId: null, displayName: 'No Native Id' })
    const undefId = contact({ nativeId: undefined, displayName: 'Undef Id' })
    const plan = planImportMerge([existing], [nullId, undefId])
    expect(plan.inserts).toEqual([nullId, undefId])
    expect(plan.overwrites).toHaveLength(0)
    expect(plan.skips).toHaveLength(0)
  })

  it('handles a mixed batch: insert + overwrite + skip in one pass', () => {
    const never = existingRow({
      _id: 'never',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({ nativeId: 'phone-never', displayName: 'Never' })
    })
    const edited = existingRow({
      _id: 'edited',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-05T00:00:00.000Z',
      contact: contact({ nativeId: 'phone-edited', displayName: 'Edited' })
    })
    const overwrite = contact({ nativeId: 'phone-never', displayName: 'v2' })
    const skip = contact({ nativeId: 'phone-edited', displayName: 'v2' })
    const insert = contact({ nativeId: 'phone-new', displayName: 'Brand New' })

    const plan = planImportMerge([never, edited], [overwrite, skip, insert])
    expect(plan.overwrites).toEqual([{ _id: 'never', contact: overwrite }])
    expect(plan.skips).toEqual([skip])
    expect(plan.inserts).toEqual([insert])
  })
})
