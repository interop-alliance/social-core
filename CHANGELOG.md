# @interop/social-core Changelog

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
