import { describe, it, expect } from 'vitest'
import {
  CONTACTS_COLLECTION,
  CONTACTS_HISTORY_COLLECTION,
  CONTACTS_COLLECTION_SPEC,
  CONTACTS_HISTORY_COLLECTION_SPEC
} from '../../src/index.js'

describe('collection constants', () => {
  it('holds the wire-format collection ids both replicas agree on', () => {
    expect(CONTACTS_COLLECTION).toBe('contacts')
    expect(CONTACTS_HISTORY_COLLECTION).toBe('contacts-history')
  })

  it('describes the head as random-id and mutable (last-write-wins)', () => {
    expect(CONTACTS_COLLECTION_SPEC).toEqual({
      collectionId: 'contacts',
      idDerivation: 'random',
      mutable: true
    })
  })

  it('describes the history as content-addressed and append-only', () => {
    expect(CONTACTS_HISTORY_COLLECTION_SPEC).toEqual({
      collectionId: 'contacts-history',
      idDerivation: 'content',
      mutable: false
    })
  })
})
