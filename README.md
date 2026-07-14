# Freewallet Social Core _(@interop/social-core)_

[![Node.js CI](https://github.com/interop-alliance/social-core/workflows/CI/badge.svg)](https://github.com/interop-alliance/social-core/actions?query=workflow%3A%22CI%22)
[![NPM Version](https://img.shields.io/npm/v/@interop/social-core.svg)](https://npm.im/@interop/social-core)

> Platform-neutral contacts data model, normalization, import-merge, and
> last-write-wins rules shared by Freewallet mobile and web.

## Table of Contents

- [Background](#background)
- [Security](#security)
- [Install](#install)
- [Usage](#usage)
- [Modules](#modules)
- [Contribute](#contribute)
- [License](#license)

## Background

Freewallet has two replicas of the same contacts feed: a React Native mobile
wallet and a web app. They sync through a shared encrypted store, so they only
converge if they agree, byte for byte, on three things:

- the **payload shapes** written into each sync envelope (`ContactData`, the
  head payload, the revision payload),
- the **import-merge rules** that decide how a re-imported address book folds
  into existing contacts, and
- the **last-write-wins rule** that settles concurrent edits to the same
  contact.

This package is the single source of truth for all three. It is pure,
dependency-free, and isomorphic (browser, Node.js, React Native): no storage, no
crypto, no platform APIs. Each replica keeps its own storage layer (SQLite on
mobile, its own store on web) and calls into this package for the shared
decisions, so the two implementations cannot drift.

## Security

This package never touches secrets, key material, or the network. It operates
only on already-decrypted, in-memory plaintext contact data. The runtime type
guards (`isContactData`, `isContactHeadPayload`, `isContactRevisionPayload`)
exist so that one replica can validate an envelope body written by the other
implementation the moment it decrypts it, before trusting its shape.

## Install

- Node.js 24+ is recommended.

### PNPM

To install via PNPM:

```
pnpm install @interop/social-core
```

### Development

To install locally (for development):

```
git clone https://github.com/interop-alliance/social-core.git
cd social-core
pnpm install
```

## Usage

Settle concurrent edits to the same contact with the shared last-write-wins
rule:

```ts
import { remotePayloadWins } from '@interop/social-core'

const takeRemote = remotePayloadWins(
  { updatedAt: remote.updatedAt, deviceId: remote.deviceId },
  { updatedAt: local.updatedAt, deviceId: local.deviceId }
)
```

Normalize a source-mapped contact before storing it:

```ts
import { normalizeContact } from '@interop/social-core'

const contact = normalizeContact({
  nativeId: entry.id,
  givenName: entry.firstName,
  familyName: entry.lastName,
  phoneNumbers: entry.phones // [{ label, number }]
})
// `contact` is `ContactData`, or `null` when there is nothing worth importing.
```

Plan a re-runnable address-book import against the contacts already stored:

```ts
import { planImportMerge } from '@interop/social-core'

const { inserts, overwrites, skips } = planImportMerge(existingRows, incoming)
// Apply inserts/overwrites inside your own storage transaction; an overwrite
// must keep the row's `updatedAt === createdAt` so it stays import-refreshable.
```

## Modules

| Module      | Exports                                                                        | Purpose                                                                   |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `types`     | `ContactData`, `ContactAction`, `ContactHeadPayload`, `ContactRevisionPayload` | The shared contact shape and the decrypted sync-envelope payload shapes.  |
| `constants` | `CONTACTS_COLLECTION`, `CONTACTS_HISTORY_COLLECTION`, and their specs          | The wire-format collection ids and id-derivation both replicas agree on.  |
| `lww`       | `remotePayloadWins`                                                            | The last-write-wins tiebreak for a mutable head document.                 |
| `normalize` | `normalizeLabel`, `normalizeContact`, `ContactInput`                           | Pure normalization of a source-mapped partial contact into `ContactData`. |
| `merge`     | `planImportMerge`                                                              | The pure insert / overwrite / skip planner for a re-runnable import.      |
| `validate`  | `isContactData`, `isContactHeadPayload`, `isContactRevisionPayload`            | Runtime guards for a payload one replica decrypts from the other.         |

## Contribute

PRs accepted. See [CONTRIBUTING.md](CONTRIBUTING.md) for editor setup (Prettier,
ESLint, and EditorConfig) and how it maps to CI.

If editing the Readme, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

[MIT License](LICENSE.md) © 2026 Interop Alliance.
