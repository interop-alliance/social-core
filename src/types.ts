/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */

/**
 * `ContactData` is our normalized contact shape, independent of any native
 * contacts library: the mapping from a platform's contact type lives in one
 * place, so the stored/synced format never depends on the import source.
 *
 * Covers every semantic field of a phone address-book contact. Deliberately
 * NOT carried from the native shape:
 *   - `recordID` -- already carried as `nativeId`.
 *   - `backTitle` -- an iOS navigation-display artifact, not contact data.
 *   - `hasThumbnail` / `thumbnailPath` -- a device-local file path; photos are
 *     deliberately never carried (they would bloat the encrypted sync
 *     envelopes; wallets render initials avatars).
 */
export type ContactData = {
  // id in the import source (phone address book, etc.), used for re-import
  // merge; null for wallet-created
  nativeId?: string | null
  displayName: string
  givenName?: string
  middleName?: string
  familyName?: string
  prefix?: string
  suffix?: string
  // maps from the native `company` field
  organization?: string
  jobTitle?: string
  department?: string
  phoneNumbers: { label: string; number: string }[]
  emailAddresses: { label: string; email: string }[]
  // both `region` and `state` are kept (Android vs iOS populate different
  // ones), so the shape stays lossless across platforms
  postalAddresses?: {
    label: string
    formattedAddress?: string
    street?: string
    pobox?: string
    neighborhood?: string
    city?: string
    region?: string
    state?: string
    postCode?: string
    country?: string
  }[]
  imAddresses?: { service: string; username: string }[]
  urlAddresses?: { label: string; url: string }[]
  birthday?: { day: number; month: number; year?: number }
  isStarred?: boolean
  note?: string
}

/**
 * A single contact mutation kind. `restore` is an ordinary edit whose payload
 * equals an older snapshot; it is tracked separately so history can distinguish
 * it from a fresh `update`.
 */
export type ContactAction = 'create' | 'update' | 'delete' | 'restore'

/**
 * The decrypted body of a `contacts` mutable head document (the payload sealed
 * inside its encrypted sync envelope). Carries `updatedAt` + `deviceId` -- never
 * on the wire in plaintext -- so last-write-wins can pick a deterministic
 * winner, and `contactId` (the originating row `_id`) so every replica's
 * projected row keeps a stable id that its revision history refers to.
 */
export type ContactHeadPayload = {
  contactId: string
  updatedAt: string
  deviceId: string
  contact: ContactData
}

/**
 * The decrypted body of a `contacts-history` revision document (append-only,
 * content-addressed). The full post-edit snapshot keeps the write path dumb and
 * view/restore trivial; `deviceId` attributes the writer inside the envelope.
 */
export type ContactRevisionPayload = {
  contactId: string
  action: ContactAction
  timestamp: string
  deviceId: string
  snapshot: ContactData
}
