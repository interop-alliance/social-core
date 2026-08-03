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
    expect(plan.stale).toHaveLength(0)
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
    expect(plan.stale).toHaveLength(0)
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
    expect(plan.stale).toHaveLength(0)
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
    // A wallet-only row has no source id, so it can never go stale.
    expect(plan.stale).toHaveLength(0)
  })

  it('never content-matches a wallet-only row, even on identical content', () => {
    const walletOnly = contact({ nativeId: null, displayName: 'Ada Lovelace' })
    const existing = existingRow({
      _id: 'wallet-only',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: walletOnly
    })
    const incoming = contact({ nativeId: 'phone-1' })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.inserts).toEqual([incoming])
    expect(plan.overwrites).toHaveLength(0)
    expect(plan.stale).toHaveLength(0)
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
    // Nothing in the batch accounted for the imported row, so it is stale.
    expect(plan.stale).toEqual([{ _id: 'c1', contact: existing.contact }])
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
    expect(plan.stale).toHaveLength(0)
  })

  it('rebinds a never-edited row when its nativeId churns (no duplicate)', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({ nativeId: 'android-aggregate-7' })
    })
    // Same person, same phone; only the source id moved.
    const incoming = contact({ nativeId: 'android-aggregate-42' })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.overwrites).toEqual([{ _id: 'c1', contact: incoming }])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.skips).toHaveLength(0)
    expect(plan.stale).toHaveLength(0)
  })

  it('rebinds an unchanged nameless row whose nativeId churned', () => {
    // Nothing but a phone number: no name and no DID, so only the exact
    // content match can reach this row.
    const nameless: ContactData = {
      nativeId: 'android-aggregate-7',
      displayName: '',
      phoneNumbers: [{ label: 'mobile', number: '555-0100' }],
      emailAddresses: []
    }
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: nameless
    })
    const incoming = { ...nameless, nativeId: 'android-aggregate-42' }
    const plan = planImportMerge([existing], [incoming])
    expect(plan.overwrites).toEqual([{ _id: 'c1', contact: incoming }])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.skips).toHaveLength(0)
    expect(plan.stale).toHaveLength(0)
  })

  it('content-matches through churned per-entry phone / email ids', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({
        nativeId: 'android-aggregate-7',
        displayName: '',
        phoneNumbers: [{ label: 'mobile', number: '555-0100', id: 'raw-11' }],
        emailAddresses: [
          { label: 'home', email: 'ada@example.com', id: 'e-11' }
        ]
      })
    })
    // The OS re-aggregated: the contact id and both sub-record ids moved,
    // while what the user typed is untouched.
    const incoming = contact({
      nativeId: 'android-aggregate-42',
      displayName: '',
      phoneNumbers: [{ label: 'mobile', number: '555-0100', id: 'raw-98' }],
      emailAddresses: [{ label: 'home', email: 'ada@example.com', id: 'e-98' }]
    })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.overwrites).toEqual([{ _id: 'c1', contact: incoming }])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.stale).toHaveLength(0)
  })

  it('exact content match ignores field order and undefined-valued fields', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: {
        displayName: '',
        emailAddresses: [],
        phoneNumbers: [{ label: 'mobile', number: '555-0100' }],
        nativeId: 'phone-old',
        note: undefined
      }
    })
    const incoming: ContactData = {
      nativeId: 'phone-new',
      displayName: '',
      phoneNumbers: [{ label: 'mobile', number: '555-0100' }],
      emailAddresses: []
    }
    const plan = planImportMerge([existing], [incoming])
    expect(plan.overwrites).toEqual([{ _id: 'c1', contact: incoming }])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.stale).toHaveLength(0)
  })

  it('inserts genuinely new content rather than content-matching it', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({
        nativeId: 'phone-old',
        displayName: '',
        phoneNumbers: [{ label: 'mobile', number: '555-0100' }]
      })
    })
    const incoming = contact({
      nativeId: 'phone-new',
      displayName: '',
      phoneNumbers: [{ label: 'mobile', number: '555-0199' }]
    })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.inserts).toEqual([incoming])
    expect(plan.overwrites).toHaveLength(0)
    expect(plan.skips).toHaveLength(0)
    expect(plan.stale).toEqual([{ _id: 'c1', contact: existing.contact }])
  })

  it('resolves an ambiguous content match to the first row in `existing` order', () => {
    const first = existingRow({
      _id: 'first',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({ nativeId: 'phone-old-a', displayName: '' })
    })
    const second = existingRow({
      _id: 'second',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({ nativeId: 'phone-old-b', displayName: '' })
    })
    const incoming = contact({ nativeId: 'phone-new', displayName: '' })
    const plan = planImportMerge([first, second], [incoming])
    expect(plan.overwrites).toEqual([{ _id: 'first', contact: incoming }])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.stale).toEqual([{ _id: 'second', contact: second.contact }])
  })

  it('skips (never duplicates) a wallet-edited row whose nativeId churned', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
      contact: contact({ nativeId: 'android-aggregate-7' })
    })
    const incoming = contact({ nativeId: 'android-aggregate-42' })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.skips).toEqual([incoming])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.overwrites).toHaveLength(0)
    expect(plan.stale).toHaveLength(0)
  })

  it('does not content-match on name alone when either side is reachable', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({
        nativeId: 'phone-old',
        phoneNumbers: [{ label: 'mobile', number: '555-0100' }]
      })
    })
    const incoming = contact({
      nativeId: 'phone-new',
      phoneNumbers: [{ label: 'mobile', number: '555-0199' }]
    })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.inserts).toEqual([incoming])
    expect(plan.overwrites).toHaveLength(0)
    expect(plan.stale).toEqual([{ _id: 'c1', contact: existing.contact }])
  })

  it('content-matches on name alone when neither side has a phone or email', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({
        nativeId: 'phone-old',
        displayName: '  Ada   LOVELACE ',
        phoneNumbers: [],
        emailAddresses: []
      })
    })
    const incoming = contact({
      nativeId: 'phone-new',
      displayName: 'ada lovelace',
      phoneNumbers: [],
      emailAddresses: []
    })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.overwrites).toEqual([{ _id: 'c1', contact: incoming }])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.stale).toHaveLength(0)
  })

  it('never steals a row whose nativeId another incoming contact claims', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({ nativeId: 'phone-1' })
    })
    // A twin arrives under a new id while `phone-1` is still in the batch.
    const twin = contact({ nativeId: 'phone-2' })
    const owner = contact({ nativeId: 'phone-1', displayName: 'Ada Lovelace' })
    const plan = planImportMerge([existing], [twin, owner])
    expect(plan.inserts).toEqual([twin])
    expect(plan.overwrites).toEqual([{ _id: 'c1', contact: owner }])
    expect(plan.stale).toHaveLength(0)
  })

  it('claims each existing row by at most one incoming contact', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({ nativeId: 'phone-old' })
    })
    const first = contact({ nativeId: 'phone-a' })
    const second = contact({ nativeId: 'phone-b' })
    const plan = planImportMerge([existing], [first, second])
    expect(plan.overwrites).toEqual([{ _id: 'c1', contact: first }])
    expect(plan.inserts).toEqual([second])
    expect(plan.stale).toHaveLength(0)
  })

  it('content-matches a phone by `digits` against a formatted `number`', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({
        nativeId: 'phone-old',
        phoneNumbers: [{ label: 'mobile', number: '+1 (555) 010-0100' }]
      })
    })
    const incoming = contact({
      nativeId: 'phone-new',
      phoneNumbers: [
        { label: 'mobile', number: 'nonsense', digits: '15550100100' }
      ]
    })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.overwrites).toEqual([{ _id: 'c1', contact: incoming }])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.stale).toHaveLength(0)
  })

  it('content-matches on a shared email when phones differ', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({
        nativeId: 'phone-old',
        phoneNumbers: [],
        emailAddresses: [{ label: 'work', email: 'Ada@Example.COM ' }]
      })
    })
    const incoming = contact({
      nativeId: 'phone-new',
      emailAddresses: [{ label: 'home', email: 'ada@example.com' }]
    })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.overwrites).toEqual([{ _id: 'c1', contact: incoming }])
    expect(plan.stale).toHaveLength(0)
  })

  it('content-matches on a shared DID alone, even when names differ', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({
        nativeId: 'phone-old',
        displayName: 'Ada King',
        phoneNumbers: [{ label: 'mobile', number: '555-0100' }],
        // A contacts UI mangled the stored DID with an https:// prefix.
        urlAddresses: [{ label: 'did', url: 'https://did:key:z6MkTest' }]
      })
    })
    const incoming = contact({
      nativeId: 'phone-new',
      displayName: 'Countess of Lovelace',
      phoneNumbers: [{ label: 'mobile', number: '555-0199' }],
      urlAddresses: [{ label: 'homepage', url: 'did:key:z6MkTest' }]
    })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.overwrites).toEqual([{ _id: 'c1', contact: incoming }])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.stale).toHaveLength(0)
  })

  it('prefers a DID match over a name match', () => {
    const namesake = existingRow({
      _id: 'namesake',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({
        nativeId: 'phone-namesake',
        phoneNumbers: [{ label: 'mobile', number: '555-0100' }]
      })
    })
    const didRow = existingRow({
      _id: 'did-row',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({
        nativeId: 'phone-did',
        displayName: 'A. K. Lovelace',
        phoneNumbers: [],
        urlAddresses: [{ label: 'did', url: 'did:key:z6MkTest' }]
      })
    })
    const incoming = contact({
      nativeId: 'phone-new',
      phoneNumbers: [{ label: 'mobile', number: '555-0100' }],
      urlAddresses: [{ label: 'did', url: 'did:key:z6MkTest' }]
    })
    const plan = planImportMerge([namesake, didRow], [incoming])
    expect(plan.overwrites).toEqual([{ _id: 'did-row', contact: incoming }])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.stale).toEqual([{ _id: 'namesake', contact: namesake.contact }])
  })

  it('does not content-match on name alone when one side has a DID', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({
        nativeId: 'phone-old',
        phoneNumbers: [],
        emailAddresses: [],
        urlAddresses: [{ label: 'did', url: 'did:key:z6MkTest' }]
      })
    })
    const incoming = contact({
      nativeId: 'phone-new',
      phoneNumbers: [],
      emailAddresses: []
    })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.inserts).toEqual([incoming])
    expect(plan.overwrites).toHaveLength(0)
    expect(plan.stale).toEqual([{ _id: 'c1', contact: existing.contact }])
  })

  it('non-DID urlAddresses do not count as shared identifiers', () => {
    const existing = existingRow({
      _id: 'c1',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({
        nativeId: 'phone-old',
        phoneNumbers: [{ label: 'mobile', number: '555-0100' }],
        urlAddresses: [{ label: 'homepage', url: 'https://example.com' }]
      })
    })
    const incoming = contact({
      nativeId: 'phone-new',
      phoneNumbers: [{ label: 'mobile', number: '555-0199' }],
      urlAddresses: [{ label: 'homepage', url: 'https://example.com' }]
    })
    const plan = planImportMerge([existing], [incoming])
    expect(plan.inserts).toEqual([incoming])
    expect(plan.overwrites).toHaveLength(0)
    expect(plan.stale).toEqual([{ _id: 'c1', contact: existing.contact }])
  })

  it('reports stale rows in `existing` order, wallet-edited ones included', () => {
    const gone = existingRow({
      _id: 'gone',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({ nativeId: 'phone-gone', displayName: 'Gone' })
    })
    const walletOnly = existingRow({
      _id: 'wallet-only',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({ nativeId: null, displayName: 'Hand Typed' })
    })
    const editedGone = existingRow({
      _id: 'edited-gone',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-05T00:00:00.000Z',
      contact: contact({ nativeId: 'phone-edited-gone', displayName: 'Edited' })
    })
    const kept = existingRow({
      _id: 'kept',
      createdAt: '2026-07-01T00:00:00.000Z',
      contact: contact({ nativeId: 'phone-kept', displayName: 'Kept' })
    })
    const incoming = contact({ nativeId: 'phone-kept', displayName: 'Kept v2' })

    const plan = planImportMerge(
      [gone, walletOnly, editedGone, kept],
      [incoming]
    )
    expect(plan.overwrites).toEqual([{ _id: 'kept', contact: incoming }])
    expect(plan.stale).toEqual([
      { _id: 'gone', contact: gone.contact },
      { _id: 'edited-gone', contact: editedGone.contact }
    ])
  })
})
