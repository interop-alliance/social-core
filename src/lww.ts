/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */

/**
 * The last-write-wins tiebreak for a mutable head document, split into its own
 * dependency-free module so the decision rule is unit-testable off-device (no
 * platform / crypto imports).
 *
 * Both replicas run this identical rule against the same two payloads, so they
 * converge on the same winner with no coordination. `updatedAt` (an ISO-8601
 * string, so lexical compare == chronological compare) decides; `deviceId`
 * breaks an exact tie deterministically. A payload that is byte-identical on
 * both fields is the same write, and the caller settles it either way.
 */

/**
 * Whether the remote payload wins over the local one under last-write-wins.
 * Later `updatedAt` wins; on an exact `updatedAt` tie the lexically greater
 * `deviceId` wins (an arbitrary but deterministic, replica-independent choice).
 *
 * @param remote {{ updatedAt: string; deviceId: string }}
 * @param local {{ updatedAt: string; deviceId: string }}
 * @returns {boolean}   true if the remote payload should replace the local one
 */
export function remotePayloadWins(
  remote: { updatedAt: string; deviceId: string },
  local: { updatedAt: string; deviceId: string }
): boolean {
  if (remote.updatedAt !== local.updatedAt) {
    return remote.updatedAt > local.updatedAt
  }
  return remote.deviceId > local.deviceId
}
