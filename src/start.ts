/* eslint-disable no-console */
import type { SecureServerOptions } from 'node:http2'
import type { ServerOptions } from 'node:https'
import type { ProxySetupOptions, ReverseProxyOption, ReverseProxyOptions, SSLConfig } from './types'
import * as fs from 'node:fs'
import * as http from 'node:http'
import * as https from 'node:https'
import * as net from 'node:net'
import process from 'node:process'
import { bold, dim, green, log } from '@stacksjs/cli'
import { version } from '../package.json'
import { config } from './config'

// Keep track of all running servers for cleanup
const activeServers: Set<http.Server | https.Server> = new Set()

/**
 * Cleanup function to close all servers and exit gracefully
 */
function cleanup() {
  console.log(`\n`)
  log.info('Shutting down proxy servers...')

  const closePromises = Array.from(activeServers).map(server =>
    new Promise<void>((resolve) => {
      server.close(() => resolve())
    }),
  )

  Promise.all(closePromises).then(() => {
    log.success('All proxy servers shut down successfully')
    process.exit(0)
  }).catch((err) => {
    log.error('Error during shutdown:', err)
    process.exit(1)
  })
}

// Register cleanup handlers
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception:', err)
  cleanup()
})

/**
 * Load SSL certificates from files or use provided strings
 */
async function loadSSLConfig(options: ReverseProxyOption): Promise<SSLConfig | null> {
  // Early return for non-SSL configuration
  if (!options.keyPath && !options.certPath)
    return null

  if ((options.keyPath && !options.certPath) || (!options.keyPath && options.certPath)) {
    const missing = !options.keyPath ? 'keyPath' : 'certPath'
    throw new Error(`SSL Configuration requires both keyPath and certPath. Missing: ${missing}`)
  }

  try {
    if (!options.keyPath || !options.certPath)
      return null

    const key = await fs.promises.readFile(options.keyPath, 'utf8')
    const cert = await fs.promises.readFile(options.certPath, 'utf8')

    return { key, cert }
  }
  catch (err) {
    const error = err as NodeJS.ErrnoException
    const detail = error.code === 'ENOENT'
      ? `File not found: ${error.path}`
      : error.message

    throw new Error(`SSL Configuration Error: ${detail}`)
  }
}

/**
 * Check if a port is in use
 */
function isPortInUse(port: number, hostname: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true)
      }
    })

    server.once('listening', () => {
      server.close()
      resolve(false)
    })

    server.listen(port, hostname)
  })
}

/**
 * Find next available port
 */
async function findAvailablePort(startPort: number, hostname: string): Promise<number> {
  let port = startPort
  while (await isPortInUse(port, hostname)) {
    log.debug(`Port ${port} is in use, trying ${port + 1}`)
    port++
  }
  return port
}

/**
 * Test connection to a server
 */
async function testConnection(hostname: string, port: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    log.debug(`Testing connection to ${hostname}:${port}...`)

    const socket = net.connect({
      host: hostname,
      port,
      timeout: 5000, // 5 second timeout
    })

    socket.once('connect', () => {
      log.debug(`Successfully connected to ${hostname}:${port}`)
      socket.end()
      resolve()
    })

    socket.once('timeout', () => {
      socket.destroy()
      reject(new Error(`Connection to ${hostname}:${port} timed out`))
    })

    socket.once('error', (err) => {
      socket.destroy()
      reject(new Error(`Failed to connect to ${hostname}:${port}: ${err.message}`))
    })
  })
}

export async function startServer(options?: ReverseProxyOption): Promise<void> {
  if (!options)
    options = config

  if (!options.from)
    options.from = config.from
  if (!options.to)
    options.to = config.to

  const fromUrl = new URL(options.from.startsWith('http') ? options.from : `http://${options.from}`)
  const toUrl = new URL(options.to.startsWith('http') ? options.to : `http://${options.to}`)
  const fromPort = Number.parseInt(fromUrl.port) || (fromUrl.protocol.includes('https:') ? 443 : 80)

  // Test connection to source server before proceeding
  try {
    await testConnection(fromUrl.hostname, fromPort)
  }
  catch (err) {
    log.error((err as Error).message)
    process.exit(1)
  }

  const sslConfig = await loadSSLConfig(options)

  await setupReverseProxy({
    ...options,
    from: options.from,
    to: toUrl.hostname,
    fromPort,
    sourceUrl: {
      hostname: fromUrl.hostname,
      host: fromUrl.host,
    },
    ssl: sslConfig,
  })
}

async function createProxyServer(
  from: string,
  to: string,
  fromPort: number,
  listenPort: number,
  hostname: string,
  sourceUrl: Pick<URL, 'hostname' | 'host'>,
  ssl: SSLConfig | null,
): Promise<void> {
  const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const proxyOptions = {
      hostname: sourceUrl.hostname,
      port: fromPort,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: sourceUrl.host,
      },
    }

    const proxyReq = http.request(proxyOptions, (proxyRes) => {
      // Add security headers
      const headers = {
        ...proxyRes.headers,
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
      }

      res.writeHead(proxyRes.statusCode || 500, headers)
      proxyRes.pipe(res)
    })

    proxyReq.on('error', (err) => {
      log.error('Proxy request failed:', err)
      res.writeHead(502)
      res.end(`Proxy Error: ${err.message}`)
    })

    req.pipe(proxyReq)
  }

  // Complete SSL configuration
  const serverOptions: (ServerOptions & SecureServerOptions) | undefined = ssl
    ? {
        key: ssl.key,
        cert: ssl.cert,
        ca: ssl.ca,
        minVersion: 'TLSv1.2' as const,
        maxVersion: 'TLSv1.3' as const,
        requestCert: false,
        rejectUnauthorized: false,
        ciphers: [
          'TLS_AES_128_GCM_SHA256',
          'TLS_AES_256_GCM_SHA384',
          'TLS_CHACHA20_POLY1305_SHA256',
          'ECDHE-ECDSA-AES128-GCM-SHA256',
          'ECDHE-RSA-AES128-GCM-SHA256',
          'ECDHE-ECDSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES256-GCM-SHA384',
        ].join(':'),
        allowHTTP1: true,
        ALPNProtocols: ['h2', 'http/1.1'],
      }
    : undefined

  const server = ssl && serverOptions
    ? https.createServer(serverOptions, requestHandler)
    : http.createServer(requestHandler)

  if (ssl) {
    server.on('secureConnection', (tlsSocket) => {
      log.debug('TLS Connection:', {
        protocol: tlsSocket.getProtocol?.(),
        cipher: tlsSocket.getCipher?.(),
        authorized: tlsSocket.authorized,
        authError: tlsSocket.authorizationError,
      })
    })
  }

  activeServers.add(server)

  return new Promise((resolve, reject) => {
    server.listen(listenPort, hostname, () => {
      console.log('')
      console.log(`  ${green(bold('reverse-proxy'))} ${green(`v${version}`)}`)
      console.log('')
      console.log(`  ${green('➜')}  ${dim(from)} ${dim('➜')} ${ssl ? 'https' : 'http'}://${to}`)
      if (listenPort !== (ssl ? 443 : 80))
        console.log(`  ${green('➜')}  Listening on port ${listenPort}`)
      if (ssl) {
        console.log(`  ${green('➜')}  SSL enabled with:`)
        console.log(`     - TLS 1.2/1.3`)
        console.log(`     - Modern cipher suite`)
        console.log(`     - HTTP/2 enabled`)
        console.log(`     - HSTS enabled`)
      }

      resolve()
    })

    server.on('error', reject)
  })
}

export async function setupReverseProxy(options: ProxySetupOptions): Promise<void> {
  const { from, to, fromPort, sourceUrl, ssl } = options
  const httpPort = 80
  const httpsPort = 443
  const hostname = '0.0.0.0'

  try {
    if (ssl) {
      const isHttpPortBusy = await isPortInUse(httpPort, hostname)
      if (!isHttpPortBusy) {
        startHttpRedirectServer()
      }
      else {
        log.warn('Port 80 is in use, HTTP to HTTPS redirect will not be available')
      }
    }

    const targetPort = ssl ? httpsPort : httpPort
    const isTargetPortBusy = await isPortInUse(targetPort, hostname)

    if (isTargetPortBusy) {
      const availablePort = await findAvailablePort(ssl ? 8443 : 8080, hostname)
      log.warn(`Port ${targetPort} is in use. Using port ${availablePort} instead.`)
      log.info(`You can use 'sudo lsof -i :${targetPort}' (Unix) or 'netstat -ano | findstr :${targetPort}' (Windows) to check what's using the port.`)

      await createProxyServer(from, to, fromPort, availablePort, hostname, sourceUrl, ssl)
    }
    else {
      await createProxyServer(from, to, fromPort, targetPort, hostname, sourceUrl, ssl)
    }
  }
  catch (err) {
    log.error(`Failed to setup reverse proxy: ${(err as Error).message}`)
    cleanup()
  }
}

export function startHttpRedirectServer(): void {
  const server = http
    .createServer((req, res) => {
      const host = req.headers.host || ''
      res.writeHead(301, {
        Location: `https://${host}${req.url}`,
      })
      res.end()
    })
    .listen(80)

  activeServers.add(server)
}

export function startProxy(options?: ReverseProxyOption): void {
  const finalOptions = {
    ...config,
    ...options,
  }

  log.debug('Starting proxy with options:', {
    from: finalOptions.from,
    to: finalOptions.to,
    keyPath: finalOptions.keyPath,
    certPath: finalOptions.certPath,
  })

  startServer(finalOptions).catch((err) => {
    log.error(`Failed to start proxy: ${err.message}`)
    cleanup()
  })
}

export function startProxies(options?: ReverseProxyOptions): void {
  if (Array.isArray(options)) {
    Promise.all(options.map(option => startServer(option)))
      .catch((err) => {
        log.error('Failed to start proxies:', err)
        cleanup()
      })
  }
  else if (options) {
    startServer(options).catch((err) => {
      log.error('Failed to start proxy:', err)
      cleanup()
    })
  }
}
