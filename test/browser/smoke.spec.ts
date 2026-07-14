import { test, expect } from '@playwright/test'

test('contacts core works in the browser bundle', async ({ page }) => {
  await page.goto('/test/index.html')
  const result = await page.evaluate(async () => {
    const { remotePayloadWins, normalizeContact } =
      await import('/src/index.ts')
    const remoteWins = remotePayloadWins(
      { updatedAt: '2026-07-06T00:00:05.000Z', deviceId: 'device-A' },
      { updatedAt: '2026-07-06T00:00:00.000Z', deviceId: 'device-Z' }
    )
    const contact = normalizeContact({
      givenName: 'Ada',
      familyName: 'Lovelace',
      phoneNumbers: [{ label: 'MOBILE', number: '555-0100' }]
    })
    return {
      remoteWins,
      displayName: contact?.displayName,
      label: contact?.phoneNumbers[0]?.label
    }
  })
  expect(result.remoteWins).toBe(true)
  expect(result.displayName).toBe('Ada Lovelace')
  expect(result.label).toBe('mobile')
})
