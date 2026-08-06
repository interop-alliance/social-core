/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */

/**
 * `ContactData` is our normalized contact shape, independent of any native
 * contacts library: the mapping from a platform's contact type lives in one
 * place, so the stored/synced format never depends on the import source.
 *
 * Covers every semantic field of a phone address-book contact. Deliberately
 * NOT carried from an import source's shape:
 *   - the source's own record identifier -- already carried as `nativeId`.
 *   - display/navigation artifacts of a particular contacts UI (sort keys,
 *     back-navigation titles), which are not contact data.
 *   - photos and their device-local file paths -- deliberately never carried
 *     (they would bloat the encrypted sync envelopes; wallets render initials
 *     avatars).
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
  // `digits` / `countryCode` are carried when the import source provides them.
  // `id` identifies the entry within the source contact; like the
  // contact-level `nativeId`, it is a diff hint rather than permanent
  // identity -- on Android sub-record ids can churn when the OS re-aggregates
  // raw contacts across accounts.
  // Optional like every other multi-entry field: a contact reachable only by
  // DID has neither a phone nor an email, and should not have to carry an
  // empty array to say so. `normalizeContact` still emits `[]` for both, so
  // its output stays byte-identical to earlier versions.
  phoneNumbers?: {
    label: string
    number: string
    digits?: string
    countryCode?: string
    id?: string
  }[]
  // `id` carries the same caveat as on `phoneNumbers`: a diff hint, not
  // permanent identity.
  emailAddresses?: { label: string; email: string; id?: string }[]
  // The administrative subdivision is carried as `region` only (import sources
  // spell it `region` or `state` depending on platform; the mapping to
  // `region` is the importer's job).
  postalAddresses?: {
    label: string
    formattedAddress?: string
    street?: string
    poBox?: string
    neighborhood?: string
    city?: string
    region?: string
    postalCode?: string
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
 * inside its encrypted sync envelope). Carries `updatedAt` + `writerId` -- never
 * on the wire in plaintext -- so last-write-wins can pick a deterministic
 * winner, and `contactId` (the originating row `_id`) so every replica's
 * projected row keeps a stable id that its revision history refers to.
 */
export type ContactHeadPayload = {
  contactId: string
  updatedAt: string
  writerId: string
  contact: ContactData
}

/**
 * The decrypted body of a `contacts-history` revision document (append-only,
 * content-addressed). The full post-edit snapshot keeps the write path dumb and
 * view/restore trivial; `writerId` attributes the writer inside the envelope.
 */
export type ContactRevisionPayload = {
  contactId: string
  action: ContactAction
  timestamp: string
  writerId: string
  snapshot: ContactData
}
