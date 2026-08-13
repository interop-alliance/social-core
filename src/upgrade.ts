/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */
import type {
  ContactData,
  ContactHeadPayload,
  ContactRevisionPayload
} from './types.js'
import { normalizeLabel } from './normalize.js'

/**
 * The postal-address spellings used before the current `ContactData` shape:
 * `postCode` / `pobox`, plus a separate `state` that existed only to stay
 * lossless across import sources that populated one or the other.
 */
type LegacyPostalAddress = {
  pobox?: string
  state?: string
  postCode?: string
}

/**
 * Re-runs {@link normalizeLabel} over a stored list of labeled entries, so a
 * row written before the iOS wrapper was stripped (`_$!<Home>!$_`) reads back
 * repaired. The same array is returned when every label already normalizes to
 * itself, which is the common case and keeps the upgrade allocation-free.
 */
function repairLabels<T extends { label: string }>(
  entries: T[] | undefined | null
): T[] | undefined | null {
  if (entries === undefined || entries === null) {
    return entries
  }

  let changed = false
  const repaired = entries.map(entry => {
    const label = normalizeLabel(entry.label)
    if (label === entry.label) {
      return entry
    }
    changed = true
    return { ...entry, label }
  })

  return changed ? repaired : entries
}

/**
 * Upgrades a stored contact to the current `ContactData` shape:
 *
 *   - `postCode` becomes `postalCode`, `pobox` becomes `poBox`, and `state`
 *     folds into `region` when `region` is absent (`state` is dropped either
 *     way -- a populated `region` always wins).
 *   - every entry label is re-normalized, which strips the iOS wrapper
 *     (`_$!<Home>!$_` reads back as `home`) from rows imported before that
 *     wrapper was handled. Import-path normalization alone cannot reach these:
 *     a row edited in the wallet is never overwritten by a re-import, and a
 *     wallet that only receives contacts over sync never imports at all.
 *
 * Apply it when loading a stored head / revision document, so documents
 * written before the shape change compare cleanly against a fresh import and
 * last-write-wins sees no spurious edit. Input already in the current shape is
 * returned unchanged, so the function is idempotent and safe to apply to every
 * load.
 *
 * @param contact a stored contact, in either the current or the legacy shape
 * @returns the contact in the current shape
 */
export function upgradeContactData(contact: ContactData): ContactData {
  const phoneNumbers = repairLabels(contact.phoneNumbers)
  const emailAddresses = repairLabels(contact.emailAddresses)
  const urlAddresses = repairLabels(contact.urlAddresses)

  const { postalAddresses } = contact
  const upgradedPostal =
    postalAddresses === undefined || postalAddresses === null
      ? postalAddresses
      : postalAddresses.map(address => {
          const legacy = address as typeof address & LegacyPostalAddress
          return {
            label: normalizeLabel(legacy.label),
            formattedAddress: legacy.formattedAddress,
            street: legacy.street,
            poBox: legacy.poBox ?? legacy.pobox,
            neighborhood: legacy.neighborhood,
            city: legacy.city,
            region: legacy.region ?? legacy.state,
            postalCode: legacy.postalCode ?? legacy.postCode,
            country: legacy.country
          }
        })

  if (
    phoneNumbers === contact.phoneNumbers &&
    emailAddresses === contact.emailAddresses &&
    urlAddresses === contact.urlAddresses &&
    upgradedPostal === postalAddresses
  ) {
    return contact
  }

  // Only the fields that were present are written back, so an absent optional
  // array is never resurrected as an explicit `undefined` key.
  const upgraded: ContactData = { ...contact }
  if (phoneNumbers !== undefined && phoneNumbers !== null) {
    upgraded.phoneNumbers = phoneNumbers
  }
  if (emailAddresses !== undefined && emailAddresses !== null) {
    upgraded.emailAddresses = emailAddresses
  }
  if (urlAddresses !== undefined && urlAddresses !== null) {
    upgraded.urlAddresses = urlAddresses
  }
  if (upgradedPostal !== undefined && upgradedPostal !== null) {
    upgraded.postalAddresses = upgradedPostal
  }
  return upgraded
}

/**
 * {@link upgradeContactData} applied to the contact inside a stored head
 * payload; the rest of the payload passes through untouched.
 */
export function upgradeContactHeadPayload(
  payload: ContactHeadPayload
): ContactHeadPayload {
  return { ...payload, contact: upgradeContactData(payload.contact) }
}

/**
 * {@link upgradeContactData} applied to the snapshot inside a stored revision
 * payload; the rest of the payload passes through untouched.
 */
export function upgradeContactRevisionPayload(
  payload: ContactRevisionPayload
): ContactRevisionPayload {
  return { ...payload, snapshot: upgradeContactData(payload.snapshot) }
}
