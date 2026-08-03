/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */
export type {
  ContactData,
  ContactAction,
  ContactHeadPayload,
  ContactRevisionPayload
} from './types.js'
export {
  CONTACTS_COLLECTION,
  CONTACTS_HISTORY_COLLECTION,
  CONTACTS_COLLECTION_SPEC,
  CONTACTS_HISTORY_COLLECTION_SPEC
} from './constants.js'
export { getDids, isDidUrl, setDids, unmangleDidUrl } from './dids.js'
export {
  SELF_CONTACT_NAME,
  isUnlinkedSeedTwin,
  selfContact
} from './seedContacts.js'
export {
  ACTION_LABELS,
  compareContactsByName,
  contactMatchesQuery,
  initialsFor,
  secondaryLineFor,
  snapshotLines
} from './display.js'
export { buildContact } from './buildContact.js'
export type { ContactFormRow } from './buildContact.js'
export { remotePayloadWins } from './lww.js'
export { normalizeLabel, normalizeContact } from './normalize.js'
export type { ContactInput } from './normalize.js'
export { planImportMerge } from './merge.js'
export {
  upgradeContactData,
  upgradeContactHeadPayload,
  upgradeContactRevisionPayload
} from './upgrade.js'
export {
  isContactData,
  isContactHeadPayload,
  isContactRevisionPayload
} from './validate.js'
