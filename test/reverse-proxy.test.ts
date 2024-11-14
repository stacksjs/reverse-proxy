import { afterEach, beforeAll, beforeEach, describe, mock } from 'bun:test'

const mockLog = {
  debug: mock(),
  error: mock(),
  info: mock(),
}

mock.module('node:fs/promises', () => ({
  mkdir: mock(),
}))

mock.module('@stacksjs/cli', () => ({
  log: mockLog,
  bold: mock(str => str),
  dim: mock(str => str),
  green: mock(str => str),
}))

describe('@stacksjs/reverse-proxy', () => {
  beforeAll(() => {
    process.env.APP_ENV = 'test'
  })

  beforeEach(() => {
    // Reset all mocks before each test
    mock.restore()

    // Re-mock @stacksjs/cli after restoring all mocks
    mock.module('@stacksjs/cli', () => ({
      log: mockLog,
      bold: mock(str => str),
      dim: mock(str => str),
      green: mock(str => str),
    }))
  })

  afterEach(() => {
    // Clean up after each test
    mock.restore()
  })

  // wip
})
