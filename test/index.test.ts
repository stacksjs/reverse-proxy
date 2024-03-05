// @ts-expect-error types are somehow missing
import { describe, expect, it } from 'bun:test'

describe('should', () => {
  it('exported', () => {
    expect(1).toEqual(1)
  })
})
