import { describe, it, expect } from 'vitest'
import { remotePayloadWins } from '../../src/index.js'

describe('remotePayloadWins', () => {
  it('the later updatedAt wins, regardless of deviceId', () => {
    expect(
      remotePayloadWins(
        { updatedAt: '2026-07-06T00:00:05.000Z', deviceId: 'device-A' },
        { updatedAt: '2026-07-06T00:00:00.000Z', deviceId: 'device-Z' }
      )
    ).toBe(true)
  })

  it('an earlier remote updatedAt loses', () => {
    expect(
      remotePayloadWins(
        { updatedAt: '2026-07-06T00:00:00.000Z', deviceId: 'device-Z' },
        { updatedAt: '2026-07-06T00:00:05.000Z', deviceId: 'device-A' }
      )
    ).toBe(false)
  })

  it('lexical string compare matches chronological order for ISO-8601', () => {
    // '...09' < '...10' lexically and chronologically.
    expect(
      remotePayloadWins(
        { updatedAt: '2026-07-06T00:00:10.000Z', deviceId: 'a' },
        { updatedAt: '2026-07-06T00:00:09.000Z', deviceId: 'z' }
      )
    ).toBe(true)
  })

  it('on an exact updatedAt tie the lexically greater deviceId wins', () => {
    const at = '2026-07-06T00:00:05.000Z'
    // remote deviceId 'device-B' > local 'device-A' so remote wins.
    expect(
      remotePayloadWins(
        { updatedAt: at, deviceId: 'device-B' },
        { updatedAt: at, deviceId: 'device-A' }
      )
    ).toBe(true)
    // Reversed: remote 'device-A' < local 'device-B' so remote loses.
    expect(
      remotePayloadWins(
        { updatedAt: at, deviceId: 'device-A' },
        { updatedAt: at, deviceId: 'device-B' }
      )
    ).toBe(false)
  })

  it('a byte-identical payload does not "win" (strictly greater comparisons)', () => {
    const p = { updatedAt: '2026-07-06T00:00:05.000Z', deviceId: 'device-A' }
    expect(remotePayloadWins(p, { ...p })).toBe(false)
  })
})
