/*!
 * Copyright (c) 2026 Interop Alliance. All rights reserved.
 */

/**
 * The last-write-wins tiebreak for a mutable head document, split into its own
 * dependency-free module so the decision rule is unit-testable off-device (no
 * platform / crypto imports).
 *
 * Both replicas run this identical rule against the same two payloads, so they
 * converge on the same winner with no coordination. `updatedAt` decides, and it
 * is compared by parsed epoch time: a lexical compare of ISO-8601 strings only
 * matches chronological order when both stamps carry the same fractional-second
 * precision (`2026-08-03T12:00:00Z` vs `2026-08-03T12:00:00.500Z` compares `Z`
 * against `.`, and the earlier stamp would win). `writerId` breaks an exact
 * tie deterministically. A payload that is byte-identical on both fields is the
 * same write, and the caller settles it either way.
 */

/**
 * Whether the remote payload wins over the local one under last-write-wins.
 * The later `updatedAt` wins, compared as parsed epoch time; if either stamp is
 * not a parseable date the two fall back to a lexical string compare, so the
 * rule stays deterministic and replica-independent either way. On an exact
 * `updatedAt` tie the lexically greater `writerId` wins (an arbitrary but
 * deterministic choice).
 *
 * @param remote {{ updatedAt: string; writerId: string }}
 * @param local {{ updatedAt: string; writerId: string }}
 * @returns {boolean}   true if the remote payload should replace the local one
 */
export function remotePayloadWins(
  remote: { updatedAt: string; writerId: string },
  local: { updatedAt: string; writerId: string }
): boolean {
  const remoteTime = Date.parse(remote.updatedAt)
  const localTime = Date.parse(local.updatedAt)
  if (Number.isNaN(remoteTime) || Number.isNaN(localTime)) {
    if (remote.updatedAt !== local.updatedAt) {
      return remote.updatedAt > local.updatedAt
    }
    return remote.writerId > local.writerId
  }
  if (remoteTime !== localTime) {
    return remoteTime > localTime
  }
  return remote.writerId > local.writerId
}
