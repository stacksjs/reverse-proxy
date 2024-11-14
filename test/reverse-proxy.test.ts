import type { ReverseProxyOption } from '../src/types'
import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { setupReverseProxy, startHttpRedirectServer, startProxies, startProxy, startServer } from '../src/start'

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
            if (event === 'error')
              handler(new Error('Connection failed'))
          },
          end: mock(),
        }
      })
      mock.module('node:net', () => ({
        connect: mockConnect,
      }))

      expect(startServer()).rejects.toThrow('Cannot start reverse proxy because localhost:3000 is unreachable.')
    })

    it('starts the server with a subdomain', async () => {
      const mockConnect = mock(() => {
        return {
          on: mock(),
          end: mock(),
        }
      })
      mock.module('node:net', () => ({
        connect: mockConnect,
      }))

      const mockSetupReverseProxy = mock()
      mock.module('../src/start', () => ({
        ...import('../src/start'),
        setupReverseProxy: mockSetupReverseProxy,
      }))

      const subdomainOption: ReverseProxyOption = {
        from: 'localhost:3000',
        to: 'subdomain.example.com',
      }
      await startServer(subdomainOption)

      expect(mockConnect).toHaveBeenCalledWith(3000, 'localhost', expect.any(Function))
      expect(mockSetupReverseProxy).toHaveBeenCalledWith({
        ...subdomainOption,
        hostname: 'localhost',
        port: 3000,
      })
      expect(mockLog.debug).toHaveBeenCalledWith('Starting Reverse Proxy Server', subdomainOption)
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
          if (event === 'listening')
            callback()
        }),
        close: mock(callback => callback()),
        listen: mock(),
      }
      mock.module('node:net', () => ({
        createServer: mock(() => mockTestServer),
      }))

      setupReverseProxy({ hostname: 'localhost', port: 3000, from: 'localhost:3000', to: 'example.com' })

      expect(mockLog.debug).toHaveBeenCalledWith('setupReverseProxy', expect.any(Object))
      expect(mockCreateServer).toHaveBeenCalled()
      expect(mockHttpServer.listen).toHaveBeenCalledWith(80, '0.0.0.0', expect.any(Function))
    })

    it('handles port 80 already in use', () => {
      const mockExit = mock(() => {})
      process.exit = mockExit as any

      const mockTestServer = {
        once: mock((event: string, callback: (err?: Error) => void) => {
          if (event === 'error') {
            const error = new Error('EADDRINUSE') as NodeJS.ErrnoException
            error.code = 'EADDRINUSE'
            callback(error)
          }
        }),
        listen: mock(),
      }
      mock.module('node:net', () => ({
        createServer: mock(() => mockTestServer),
      }))

      setupReverseProxy({
        from: 'localhost:3000',
        to: 'example.com',
      })

      expect(mockLog.debug).toHaveBeenCalledWith('setupReverseProxy', expect.any(Object))
      expect(mockTestServer.once).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockTestServer.listen).toHaveBeenCalledWith(80, '0.0.0.0')
      expect(mockLog.error).toHaveBeenCalled()
      expect(mockLog.info).toHaveBeenCalled()
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('sets up the reverse proxy server for a subdomain', () => {
      const mockHttpServer = {
        listen: mock(),
      }
      const mockCreateServer = mock(() => mockHttpServer)
      mock.module('node:http', () => ({
        createServer: mockCreateServer,
      }))

      const mockTestServer = {
        once: mock((event, callback) => {
          if (event === 'listening')
            callback()
        }),
        close: mock(callback => callback()),
        listen: mock(),
      }
      mock.module('node:net', () => ({
        createServer: mock(() => mockTestServer),
      }))

      const subdomainOption: ReverseProxyOption = {
        from: 'localhost:3000',
        to: 'subdomain.example.com',
      }
      setupReverseProxy(subdomainOption)

      expect(mockLog.debug).toHaveBeenCalledWith('setupReverseProxy', subdomainOption)
      expect(mockCreateServer).toHaveBeenCalled()
      expect(mockHttpServer.listen).toHaveBeenCalledWith(80, '0.0.0.0', expect.any(Function))

      // Check if the 'host' header is set correctly for the subdomain
      const createServerCallback = mockCreateServer.mock.calls[0]?.[0]
      const mockReq = { url: '/', method: 'GET', headers: {} }
      const mockRes = { writeHead: mock(), end: mock() }
      const mockProxyReq = { on: mock(), end: mock() }

      mock.module('node:http', () => ({
        ...import('node:http'),
        request: mock(() => mockProxyReq),
      }))

      createServerCallback(mockReq, mockRes)

      expect(import('node:http').request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'localhost',
          port: 3000,
          headers: expect.objectContaining({
            host: 'subdomain.example.com',
          }),
        }),
        expect.any(Function),
      )
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
        ...import('../src/start'),
        startServer: mockStartServer,
      }))

      const option: ReverseProxyOption = { from: 'localhost:4000', to: 'example.com' }
      startProxy(option)

      expect(mockStartServer).toHaveBeenCalledWith(option)
    })
  })

  describe('startProxies', () => {
    it('starts multiple proxies when given an array', async () => {
      const mockStartServer = mock(() => Promise.resolve())
      mock.module('../src/start', () => ({
        ...import('../src/start'),
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
        ...import('../src/start'),
        startServer: mockStartServer,
      }))

      const option: ReverseProxyOption = { from: 'localhost:4000', to: 'example.com' }
      startProxies(option)

      expect(mockStartServer).toHaveBeenCalledWith(option)
    })
  })
})
