import { describe, it, expect } from 'vitest'
import { remotePayloadWins } from '../../src/index.js'

describe('remotePayloadWins', () => {
  it('the later updatedAt wins, regardless of writerId', () => {
    expect(
      remotePayloadWins(
        { updatedAt: '2026-07-06T00:00:05.000Z', writerId: 'writer-a' },
        { updatedAt: '2026-07-06T00:00:00.000Z', writerId: 'writer-z' }
      )
    ).toBe(true)
  })

  it('an earlier remote updatedAt loses', () => {
    expect(
      remotePayloadWins(
        { updatedAt: '2026-07-06T00:00:00.000Z', writerId: 'writer-z' },
        { updatedAt: '2026-07-06T00:00:05.000Z', writerId: 'writer-a' }
      )
    ).toBe(false)
  })

  it('compares same-precision stamps chronologically', () => {
    // '...09' < '...10' chronologically.
    expect(
      remotePayloadWins(
        { updatedAt: '2026-07-06T00:00:10.000Z', writerId: 'writer-a' },
        { updatedAt: '2026-07-06T00:00:09.000Z', writerId: 'writer-z' }
      )
    ).toBe(true)
  })

  it('orders mixed fractional-second precision by time, not lexically', () => {
    // A lexical compare hits 'Z' vs '.' and picks the earlier stamp.
    const noFraction = '2026-08-03T12:00:00Z'
    const withMillis = '2026-08-03T12:00:00.500Z'
    // Remote is the later stamp, so it wins.
    expect(
      remotePayloadWins(
        { updatedAt: withMillis, writerId: 'writer-a' },
        { updatedAt: noFraction, writerId: 'writer-z' }
      )
    ).toBe(true)
    // Reversed: the remote no-fraction stamp is the earlier one, so it loses.
    expect(
      remotePayloadWins(
        { updatedAt: noFraction, writerId: 'writer-z' },
        { updatedAt: withMillis, writerId: 'writer-a' }
      )
    ).toBe(false)
  })

  it('treats stamps for the same instant in different forms as a tie', () => {
    // Same instant, different spellings: the writerId tiebreak decides.
    expect(
      remotePayloadWins(
        { updatedAt: '2026-08-03T12:00:00Z', writerId: 'writer-b' },
        { updatedAt: '2026-08-03T12:00:00.000Z', writerId: 'writer-a' }
      )
    ).toBe(true)
    expect(
      remotePayloadWins(
        { updatedAt: '2026-08-03T12:00:00.000Z', writerId: 'writer-a' },
        { updatedAt: '2026-08-03T12:00:00Z', writerId: 'writer-b' }
      )
    ).toBe(false)
  })

  it('falls back to a lexical compare when a stamp is unparseable', () => {
    expect(
      remotePayloadWins(
        { updatedAt: 'not-a-date-b', writerId: 'writer-a' },
        { updatedAt: 'not-a-date-a', writerId: 'writer-z' }
      )
    ).toBe(true)
    // Identical unparseable stamps fall through to the writerId tiebreak.
    expect(
      remotePayloadWins(
        { updatedAt: 'not-a-date', writerId: 'writer-b' },
        { updatedAt: 'not-a-date', writerId: 'writer-a' }
      )
    ).toBe(true)
  })

  it('on an exact updatedAt tie the lexically greater writerId wins', () => {
    const at = '2026-07-06T00:00:05.000Z'
    // remote writerId 'writer-b' > local 'writer-a' so remote wins.
    expect(
      remotePayloadWins(
        { updatedAt: at, writerId: 'writer-b' },
        { updatedAt: at, writerId: 'writer-a' }
      )
    ).toBe(true)
    // Reversed: remote 'writer-a' < local 'writer-b' so remote loses.
    expect(
      remotePayloadWins(
        { updatedAt: at, writerId: 'writer-a' },
        { updatedAt: at, writerId: 'writer-b' }
      )
    ).toBe(false)
  })

  it('a byte-identical payload does not "win" (strictly greater comparisons)', () => {
    const p = { updatedAt: '2026-07-06T00:00:05.000Z', writerId: 'writer-a' }
    expect(remotePayloadWins(p, { ...p })).toBe(false)
  })
})
