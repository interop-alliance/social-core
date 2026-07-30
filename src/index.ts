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
export { getDids, unmangleDidUrl } from './dids.js'
export { remotePayloadWins } from './lww.js'
export { normalizeLabel, normalizeContact } from './normalize.js'
export type { ContactInput } from './normalize.js'
export { planImportMerge } from './merge.js'
export {
  isContactData,
  isContactHeadPayload,
  isContactRevisionPayload
} from './validate.js'
