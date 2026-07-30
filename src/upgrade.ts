/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */
import type {
  ContactData,
  ContactHeadPayload,
  ContactRevisionPayload
} from './types.js'

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
 * Upgrades a stored contact to the current `ContactData` shape: `postCode`
 * becomes `postalCode`, `pobox` becomes `poBox`, and `state` folds into
 * `region` when `region` is absent (`state` is dropped either way -- a
 * populated `region` always wins).
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
  const { postalAddresses } = contact
  if (postalAddresses === undefined || postalAddresses === null) {
    return contact
  }

  return {
    ...contact,
    postalAddresses: postalAddresses.map(address => {
      const legacy = address as typeof address & LegacyPostalAddress
      return {
        label: legacy.label,
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
  }
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
