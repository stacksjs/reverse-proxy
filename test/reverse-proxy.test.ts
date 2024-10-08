import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import * as http from 'node:http'
import * as net from 'node:net'
import { setupReverseProxy, startHttpRedirectServer, startProxies, startProxy, startServer } from '../src/start'
import type { ReverseProxyOption } from '../src/types'

describe('@stacksjs/reverse-proxy', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mock.restore()
  })

  afterEach(() => {
    // Clean up after each test
    mock.restore()
  })

  describe('startServer', () => {
    it('starts the server with default options', async () => {
      const mockConnect = mock(() => {
        return {
          on: mock(),
          end: mock(),
        }
      })
      mock.module('node:net', () => ({
        connect: mockConnect,
      }))

      await startServer()

      expect(mockConnect).toHaveBeenCalled()
    })

    it('handles connection errors', async () => {
      const mockConnect = mock(() => {
        return {
          on: (event: string, handler: (err: Error) => void) => {
            if (event === 'error') handler(new Error('Connection failed'))
          },
          end: mock(),
        }
      })
      mock.module('node:net', () => ({
        connect: mockConnect,
      }))

      await expect(startServer()).rejects.toThrow('Cannot start reverse proxy because localhost:3000 is unreachable.')
    })
  })

  describe('setupReverseProxy', () => {
    it('sets up the reverse proxy server', () => {
      const mockHttpServer = {
        listen: mock(),
      }
      const mockCreateServer = mock(() => mockHttpServer)
      mock.module('node:http', () => ({
        createServer: mockCreateServer,
      }))

      const mockTestServer = {
        once: mock((event, callback) => {
          if (event === 'listening') callback()
        }),
        close: mock((callback) => callback()),
        listen: mock(),
      }
      mock.module('node:net', () => ({
        createServer: mock(() => mockTestServer),
      }))

      setupReverseProxy({ hostname: 'localhost', port: 3000, from: 'localhost:3000', to: 'example.com' })

      expect(mockCreateServer).toHaveBeenCalled()
      expect(mockHttpServer.listen).toHaveBeenCalledWith(80, '0.0.0.0', expect.any(Function))
    })
  })

  describe('startHttpRedirectServer', () => {
    it('starts the HTTP redirect server', () => {
      const mockServer = {
        listen: mock(),
      }
      const mockCreateServer = mock(() => mockServer)
      mock.module('node:http', () => ({
        createServer: mockCreateServer,
      }))

      startHttpRedirectServer()

      expect(mockCreateServer).toHaveBeenCalled()
      expect(mockServer.listen).toHaveBeenCalledWith(80)
    })
  })

  describe('startProxy', () => {
    it('calls startServer with the provided option', async () => {
      const mockStartServer = mock(() => Promise.resolve())
      mock.module('../src/start', () => ({
        ...require('../src/start'),
        startServer: mockStartServer,
      }))

      const option: ReverseProxyOption = { from: 'localhost:4000', to: 'example.com' }
      await startProxy(option)

      expect(mockStartServer).toHaveBeenCalledWith(option)
    })
  })

  describe('startProxies', () => {
    it('starts multiple proxies when given an array', async () => {
      const mockStartServer = mock(() => Promise.resolve())
      mock.module('../src/start', () => ({
        ...require('../src/start'),
        startServer: mockStartServer,
      }))

      const options: ReverseProxyOption[] = [
        { from: 'localhost:4000', to: 'example1.com' },
        { from: 'localhost:5000', to: 'example2.com' },
      ]
      startProxies(options)

      expect(mockStartServer).toHaveBeenCalledTimes(2)
      expect(mockStartServer).toHaveBeenCalledWith(options[0])
      expect(mockStartServer).toHaveBeenCalledWith(options[1])
    })

    it('starts a single proxy when given a single option', async () => {
      const mockStartServer = mock(() => Promise.resolve())
      mock.module('../src/start', () => ({
        ...require('../src/start'),
        startServer: mockStartServer,
      }))

      const option: ReverseProxyOption = { from: 'localhost:4000', to: 'example.com' }
      startProxies(option)

      expect(mockStartServer).toHaveBeenCalledWith(option)
    })
  })
})
