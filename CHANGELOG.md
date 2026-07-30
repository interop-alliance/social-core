# @interop/social-core Changelog

## 0.4.0 - TBD

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
