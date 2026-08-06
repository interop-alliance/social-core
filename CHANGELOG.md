# @interop/social-core Changelog

## 0.8.0 - 2026-08-05

### Changed

- **BREAKING**: the `deviceId` field on `ContactHeadPayload` and
  `ContactRevisionPayload` (and their structural guards) is renamed to
  `writerId`. It is an unkeyed, clearable attribution label for the writing
  agent, not a hardware identity. No alias is kept.

### Fixed

- `remotePayloadWins` compares `updatedAt` by parsed epoch time instead of
  lexically, so stamps written at different fractional-second precisions order
  chronologically (`2026-08-03T12:00:00Z` compared lexically against
  `2026-08-03T12:00:00.500Z` picked the earlier stamp). If either stamp is
  unparseable the comparison falls back to the previous lexical compare; the
  exact-tie `writerId` tiebreak is unchanged.

## 0.7.0 - 2026-08-03

### Added

- The self-contact seed every wallet starts a new account with:
  `selfContact({ dids, email })` and the display name it is stored under,
  `SELF_CONTACT_NAME`. The name is convergence-critical -- a pull path
  recognizes another replica's copy of a seed by its exact display name -- so
  every wallet now spells it from one place. The seed is emitted through
  `normalizeContact`, so it carries the same shape every other write path
  produces. A wallet's own additional seeds stay app-side.
- `isUnlinkedSeedTwin(local, incoming, seedNames)`: the pure predicate a pull
  path absorbs another replica's copy of a seed with, instead of inserting a
  duplicate. True when the incoming contact is named by `seedNames` (the
  caller's own seed set), the local row carries the same name, and the local row
  has not been customized (no phone, email, organization, or note). The caller
  supplies only rows still unlinked to the remote feed, and keeps its own
  storage transaction around it.
- Contact display helpers, so a contact reads identically on both wallets:
  `initialsFor` (initials avatar), `secondaryLineFor` (the line under a name),
  `contactMatchesQuery` + `compareContactsByName` (contact-list search and
  order), and `ACTION_LABELS` + `snapshotLines` (revision history).
- `buildContact({ existing, displayName, givenName, familyName, organization, note, phoneNumbers, emailAddresses, dids })`:
  the headless half of a contact edit form. Carries through every field the form
  does not surface, trims and clears emptied fields to `undefined`, normalizes
  entry labels, drops blank rows while preserving carried-through entry
  metadata, and folds the DID rows back through `setDids`. The row shape is
  exported as `ContactFormRow`.
- `isDidUrl(url)`: the single "is this a DID?" predicate, now shared by the read
  side (`getDids` / `setDids`, whose behavior is unchanged) and by an edit
  form's write-side validation -- which must refuse exactly what the read side
  would not surface, or persist an entry that is invisible on every screen.

### Fixed

- `planImportMerge` no longer duplicates a re-imported contact whose `nativeId`
  churned but whose content is unchanged and which the existing content
  heuristics could not reach -- notably a nameless, phone-number-only row (the
  DID and name+phone/email rules both need something to key on). The content
  fallback now tries an exact content match first: equal on every field but the
  churn-prone id metadata (the contact's own `nativeId` and the per-entry `id`
  hints on phones / emails, which Android renumbers when the OS re-aggregates
  raw contacts). Candidates are still restricted to rows no incoming contact
  claims by `nativeId`, and an ambiguous match resolves deterministically to the
  first unclaimed row in `existing` order.

## 0.6.0 - 2026-08-01

### Added

- `setDids(contact, dids)`: the write-side counterpart of `getDids`. Replaces a
  contact's `did:` entries (by the same scheme predicate, including mangled
  `http(s)://did:` urls) with the given list, carrying non-DID `urlAddresses`
  entries through untouched, labeling each DID entry `'did'`, trimming, dropping
  blanks, and collapsing exact repeats to the first occurrence.

### Changed

- `getDids` now dedupes its result (exact comparison, first occurrence wins): a
  merge from another replica can leave the same DID on two entries, and a
  contact holding one DID twice means nothing beyond holding it once.

## 0.5.0 - 2026-07-30

### Changed

- `ContactData.phoneNumbers` and `ContactData.emailAddresses` are now optional,
  like every other multi-entry field: a contact reachable only by DID has
  neither, and should not have to carry an empty array to say so.
  `isContactData` accepts them absent (still rejecting a present-but-malformed
  array), and `normalizeContact` is unchanged -- it keeps emitting `[]` for
  both, so its output stays byte-identical. Consumers that read either field
  without a `?? []` guard need updating.

## 0.4.0 - 2026-07-30

### Changed

- **BREAKING**: `planImportMerge` now returns a fourth bucket, `stale`: the
  existing source-imported rows (`nativeId` non-null) that the batch neither
  matched by `nativeId` nor claimed by content -- orphans whose source id
  vanished, wallet-edited ones included. It is advisory: the planner still never
  deletes anything, so a caller decides whether to offer cleanup, re-link, or
  ignore them. Wallet-only rows (null `nativeId`) are never stale. Callers that
  exhaustively destructure or type the return value need updating.
- `planImportMerge` falls back to a content match when an incoming contact's
  `nativeId` matches no row, so a contact whose source id churned -- notably
  Android's aggregate contact id, which changes when the OS re-links raw
  contacts across accounts -- rebinds to its existing row instead of duplicating
  it. Only rows holding a `nativeId` that no contact in the batch claims are
  candidates, and each row can be claimed by at most one incoming contact (first
  match wins, in incoming order). A shared DID matches on its own, even when the
  display names differ. Otherwise a candidate matches when the normalized
  display names are equal and non-empty AND the two share at least one
  normalized phone or email -- or, when both sides have no phones, emails, or
  DIDs at all, on the name alone. Phones compare by `digits` when present, else
  by the digits of `number`; emails compare trimmed and lowercased; names
  compare NFKC-normalized, lowercased, and whitespace-collapsed; DIDs are taken
  from `urlAddresses` via `getDids` and compared verbatim. A matched row that
  was never wallet-edited is overwritten, which rebinds it to the new
  `nativeId`; a wallet-edited one is skipped, keeping the invariant that a
  wallet edit is never overwritten by an import while still not duplicating the
  row. Contacts and rows with a null/undefined `nativeId` never participate.

## 0.3.0 - 2026-07-30

### Changed

- **BREAKING**: postal addresses in `ContactData` / `ContactInput` now spell the
  postal code `postalCode` (was `postCode`) and the post-office box `poBox` (was
  `pobox`).
- **BREAKING**: the administrative subdivision is carried as `region` only; the
  parallel `state` field is gone. Mapping a source that reports a `state` onto
  `region` is the importer's job, keeping exactly one spelling per field in
  `ContactInput`. Documents stored under the old shape upgrade via
  `upgradeContactData` (see below).
- `phoneNumbers` entries can now carry `digits`, `countryCode`, and an `id`;
  `emailAddresses` entries can carry an `id`. All are optional, so an importer
  that has none of them produces the same output as before. Note the caveat
  documented on the fields: like the contact-level `nativeId`, a sub-record `id`
  can churn when a platform re-aggregates raw contacts across accounts, so treat
  it as a diff hint rather than permanent identity.
- `ContactInput` phone / email entries now take an optional, nullable `number` /
  `email`, so an importer can pass a source's entries straight through without
  pre-filtering. `normalizeContact` trims them and DROPS entries that are empty
  afterwards -- and it now does so before deciding whether the contact has any
  contact method at all, so a placeholder entry can no longer keep a nameless
  contact that has nothing to reach it by. Callers that relied on empty entries
  surviving normalization will see shorter arrays.
- `isContactData` checks the new field spellings and the new optional sub-record
  fields. It ignores fields it does not know, so a document stored under the old
  spellings still validates: decrypt, validate, and upgrade in whichever order
  suits the consumer.
- Documented `ContactInput.birthday.month` as 1-indexed (1 = January) at the
  contract boundary. `normalizeContact` requires `month > 0`, so an importer
  whose source uses the 0-indexed JS `Date` convention must add 1 before
  calling; passing a raw 0-indexed month silently drops every January birthday
  and shifts the rest back by one.

### Added

- `upgradeContactData`, plus the `upgradeContactHeadPayload` /
  `upgradeContactRevisionPayload` conveniences, for the read path: renames
  `postCode` / `pobox` and folds `state` into `region` when `region` is absent.
  Apply it when loading stored head / revision documents so pre-change documents
  compare cleanly against a fresh import and last-write-wins sees no spurious
  edit. Input already in the current shape is returned unchanged, so it is
  idempotent and safe to apply on every load.

## 0.2.0 - 2026-07-30

### Added

- `getDids` helper returning a contact's DIDs from `urlAddresses`, matching on
  the `did:` scheme rather than the entry label (native address books do not
  reliably round-trip custom labels), and `unmangleDidUrl` to tolerate the
  `http(s)://` prefix some contacts apps prepend to edited URLs.

## 0.1.0-0.1.1 - TBD

### Added

- Initial extraction of the platform-neutral contacts core from the Freewallet
  mobile wallet, so the same data model and rules can back the Freewallet web
  app:
  - `ContactData`, `ContactAction`, `ContactHeadPayload`, and
    `ContactRevisionPayload` types.
  - `CONTACTS_COLLECTION` / `CONTACTS_HISTORY_COLLECTION` ids and their
    declarative collection specs.
  - `remotePayloadWins` last-write-wins tiebreak.
  - `normalizeLabel` / `normalizeContact` import normalization.
  - `planImportMerge` re-runnable address-book import planner.
  - `isContactData` / `isContactHeadPayload` / `isContactRevisionPayload`
    runtime type guards.
- Expanded `ContactData` (and `ContactInput` / `normalizeContact` /
  `isContactData`) to cover every semantic address-book field: `middleName`,
  `prefix`, `suffix`, `jobTitle`, `department`, `postalAddresses`,
  `imAddresses`, `urlAddresses`, `birthday`, and `isStarred` -- all optional, so
  payloads written under the earlier shape remain valid.
