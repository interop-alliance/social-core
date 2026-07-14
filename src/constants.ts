/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */

/**
 * The synced collection ids for contacts. `contacts` is the mutable
 * head-document (last-write-wins) collection; `contacts-history` is its
 * append-only revision log. Both replicas (mobile and web) must use these exact
 * ids, or their writes land in separate collections and never converge.
 */
export const CONTACTS_COLLECTION = 'contacts'
export const CONTACTS_HISTORY_COLLECTION = 'contacts-history'

/**
 * A declarative descriptor of how a synced collection derives document ids and
 * whether its documents are mutable. `idDerivation` is `'random'` for a mutable
 * head (a stable id whose body is overwritten) and `'content'` for an
 * append-only, content-addressed log (the id IS the hash of the body).
 *
 * Both replicas must agree on these values for a collection: they decide how a
 * document is located on the server and whether it is overwritten in place or
 * only ever appended, so a disagreement would split the feed in two.
 */
export const CONTACTS_COLLECTION_SPEC: {
  collectionId: string
  idDerivation: 'content' | 'random'
  mutable: boolean
} = {
  collectionId: CONTACTS_COLLECTION,
  idDerivation: 'random',
  mutable: true
}

export const CONTACTS_HISTORY_COLLECTION_SPEC: {
  collectionId: string
  idDerivation: 'content' | 'random'
  mutable: boolean
} = {
  collectionId: CONTACTS_HISTORY_COLLECTION,
  idDerivation: 'content',
  mutable: false
}
