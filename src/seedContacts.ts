/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */

/**
 * The generic contact a new wallet seeds itself with -- the user's own
 * self-contact -- and the predicate a pull path absorbs another replica's copy
 * of a seed with.
 *
 * Convergence-critical: every replica seeds its rows under its own fresh
 * random id, so a wallet linking into an established feed pulls the feed's
 * copies alongside its own. The pull path recognizes a pulled seed by its
 * EXACT display name, so every wallet seeding a given row must spell its name
 * identically -- a drift of one character duplicates that row on every
 * install, forever. That is what {@link SELF_CONTACT_NAME} is exported for.
 *
 * A wallet with its own additional seeds (a vendor or team contact, say) keeps
 * them app-side, and passes their names to {@link isUnlinkedSeedTwin} beside
 * this one.
 */
import type { ContactData } from './types.js'
import { setDids } from './dids.js'
import { normalizeContact } from './normalize.js'

/**
 * The display name of the self-contact, exported so a wallet listing its seed
 * names for {@link isUnlinkedSeedTwin} can reference the string rather than
 * retype it.
 */
export const SELF_CONTACT_NAME = 'You (this user)'

/**
 * Runs a seed literal through `normalizeContact`, so the stored row has the
 * exact shape every other write path produces (e.g. `phoneNumbers` /
 * `emailAddresses` always present as `[]`) -- a consumer must never meet a
 * looser shape on a seeded row than on any imported or hand-entered one, and
 * an unchanged save (or a merge from the other replica) must not rewrite the
 * row and churn a revision.
 */
function normalizedSeed(contact: ContactData): ContactData {
  const normalized = normalizeContact(contact)
  if (normalized === null) {
    throw new Error(
      `Seed contact "${contact.displayName}" failed normalization.`
    )
  }
  return normalized
}

/**
 * The user's own contact, seeded into a new wallet: the DIDs just minted for
 * this user and, when there is one, the email they entered at signup.
 *
 * Both are optional and both are omitted rather than blank when absent: a
 * guest, a wallet with no storage server, or a failed provisioning has no DID
 * to carry, and a guest's internal placeholder email is never user-entered.
 * A caller with several DIDs (a `did:web` and a `did:webvh`, say) passes them
 * all, in the order they should appear.
 *
 * @param options {object}
 * @param [options.dids] {string[]}   the DIDs minted for this user
 * @param [options.email] {string}    the email entered at signup
 * @returns {ContactData}
 */
export function selfContact({
  dids = [],
  email
}: {
  dids?: string[]
  email?: string
}): ContactData {
  const seed = setDids({ displayName: SELF_CONTACT_NAME }, dids)
  return normalizedSeed(
    email ? { ...seed, emailAddresses: [{ label: '', email }] } : seed
  )
}

/**
 * Whether a pulled contact is the remote copy of a local seed the caller has
 * not linked to the remote feed yet -- in which case the local row should
 * adopt the pulled document rather than the pull inserting a second copy of
 * the seed.
 *
 * True when `incoming` is one of `seedNames` by display name, `local` carries
 * the same name, and `local` has not been customized: no phone, no email, no
 * organization, no note. A row the user has grown must never be silently
 * absorbed, so growth in any of those fields disqualifies it.
 *
 * `seedNames` is supplied by the caller, since a wallet's seed set is its own
 * (this package ships only the self-contact, as {@link SELF_CONTACT_NAME}).
 * Every wallet sharing a feed must pass the same strings, or a seed one of
 * them recognizes will duplicate on the other.
 *
 * The caller supplies only rows that are still unlinked (no sync id) and in
 * the same account/profile; adopting one is a purely local merge, since an
 * unlinked row has never left this wallet.
 *
 * @param local {ContactData}     an unlinked local contact
 * @param incoming {ContactData}  the pulled contact
 * @param seedNames {string[]}    the display names of this wallet's seeds
 * @returns {boolean}
 */
export function isUnlinkedSeedTwin(
  local: ContactData,
  incoming: ContactData,
  seedNames: string[]
): boolean {
  return (
    seedNames.includes(incoming.displayName) &&
    local.displayName === incoming.displayName &&
    (local.phoneNumbers ?? []).length === 0 &&
    (local.emailAddresses ?? []).length === 0 &&
    !local.organization &&
    !local.note
  )
}
