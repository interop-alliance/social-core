/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */

/**
 * The headless half of a contact edit form: assembling the fields a form
 * surfaces, plus the contact it was loaded from, into the `ContactData` that
 * gets stored. Both wallets bind their own inputs; the assembly rules -- which
 * fields are trimmed, which are carried through untouched, how labels are
 * normalized and how DID rows fold back into `urlAddresses` -- live here, so a
 * contact edited on one wallet serializes byte-identically to the same edit
 * made on the other.
 */
import type { ContactData } from './types.js'
import { setDids } from './dids.js'
import { normalizeLabel } from './normalize.js'

/**
 * One editable phone / email row. `label` and `value` are what a form
 * surfaces; `digits`, `countryCode` and `id` are carried through from the
 * loaded contact so an edit does not strip what an importer recorded. A form
 * that clears a row's value should clear `digits` / `countryCode` with it --
 * they are derived from the number, and a stale pair would outlive the number
 * it described.
 */
export type ContactFormRow = {
  label?: string
  value?: string
  digits?: string
  countryCode?: string
  id?: string
}

/**
 * Emits `key` only when the carried-through value is present, so a row that
 * never had one stays byte-identical to what the other replica writes.
 */
function carried<Key extends string>(
  key: Key,
  value: string | undefined
): Partial<Record<Key, string>> {
  return value === undefined ? {} : ({ [key]: value } as Record<Key, string>)
}

/**
 * Assembles a form's state into the `ContactData` to store.
 *
 * `existing` (the contact being edited, absent when adding) is spread first,
 * so every field the form does not surface -- `nativeId`, `middleName`,
 * prefix/suffix, job title, department, postal addresses, IM addresses,
 * birthday, starred -- survives a save instead of being silently stripped.
 * The form-bound fields then override, with an emptied field clearing to
 * `undefined` rather than storing a blank string.
 *
 * The display name falls back to `givenName familyName` when the name field is
 * empty; the result can still be empty, and the caller is responsible for
 * refusing to save a nameless contact. Phone / email rows whose value is blank
 * after trimming are dropped, and their labels go through `normalizeLabel`
 * (lowercased, `'other'` when blank) so both wallets store identical labels.
 * The DID rows replace the contact's `did:` entries through `setDids`:
 * non-DID `urlAddresses` entries -- a homepage an importer recorded, say --
 * are carried through untouched, blanks are dropped and repeats collapse to
 * the first occurrence. A DID row the read side would not surface is NOT
 * rejected here; a form validates that with `isDidUrl` before saving, so it
 * can point at the offending row.
 *
 * @param options {object}
 * @param [options.existing] {ContactData}      the contact being edited
 * @param [options.displayName] {string}
 * @param [options.givenName] {string}
 * @param [options.familyName] {string}
 * @param [options.organization] {string}
 * @param [options.note] {string}
 * @param [options.phoneNumbers] {ContactFormRow[]}
 * @param [options.emailAddresses] {ContactFormRow[]}
 * @param [options.dids] {string[]}             the DID rows, in display order
 * @returns {ContactData}
 */
export function buildContact({
  existing,
  displayName = '',
  givenName = '',
  familyName = '',
  organization = '',
  note = '',
  phoneNumbers = [],
  emailAddresses = [],
  dids = []
}: {
  existing?: ContactData
  displayName?: string
  givenName?: string
  familyName?: string
  organization?: string
  note?: string
  phoneNumbers?: ContactFormRow[]
  emailAddresses?: ContactFormRow[]
  dids?: string[]
}): ContactData {
  const trimmedName =
    displayName.trim() || `${givenName.trim()} ${familyName.trim()}`.trim()
  return setDids(
    {
      ...existing,
      displayName: trimmedName,
      givenName: givenName.trim() || undefined,
      familyName: familyName.trim() || undefined,
      organization: organization.trim() || undefined,
      phoneNumbers: phoneNumbers
        .filter(row => (row.value ?? '').trim())
        .map(row => ({
          label: normalizeLabel(row.label),
          number: (row.value ?? '').trim(),
          ...carried('digits', row.digits),
          ...carried('countryCode', row.countryCode),
          ...carried('id', row.id)
        })),
      emailAddresses: emailAddresses
        .filter(row => (row.value ?? '').trim())
        .map(row => ({
          label: normalizeLabel(row.label),
          email: (row.value ?? '').trim(),
          ...carried('id', row.id)
        })),
      note: note.trim() || undefined
    },
    dids
  )
}
