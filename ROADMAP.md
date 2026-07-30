# Roadmap

## Known issues

### `planImportMerge` duplicates a contact when its `nativeId` changes

Discovered 2026-07-30 while verifying the merge path during the mobile wallet's
contacts-importer migration; pre-existing behavior, not introduced by the
`ContactData` v2 shape change.

`planImportMerge` indexes the profile's existing rows by `nativeId` only
(`byNativeId`) and, on no match, unconditionally pushes the incoming contact to
`inserts`. There is no content-based fallback (no name/phone/email matching),
and nothing removes rows whose `nativeId` no longer appears in the import. So
when a source id churns for an otherwise-identical contact -- notably Android's
aggregate contact id, which can change when the OS re-links raw contacts across
accounts -- a re-import yields two rows:

- the old row, now orphaned (its `nativeId` will never match a future import, so
  it stops being refreshed), and
- a fresh insert under the new `nativeId`.

Possible fixes, to be designed deliberately (both change merge semantics for
every consumer):

- a content-match fallback for incoming contacts whose `nativeId` finds no row
  (for example, match on normalized display name plus phone/email overlap; the
  per-entry `id`s on phones/emails can help stabilize the comparison), and/or
- a new output bucket for "stale" existing rows whose `nativeId` vanished from
  the source, so callers can offer cleanup instead of silently accumulating
  orphans.

Whatever lands must keep the current invariant that a wallet-edited row
(`updatedAt !== createdAt`) is never overwritten by an import.
