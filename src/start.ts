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
import { generateCertficate } from './certificate'
import { config } from './config'
import { debugLog } from './utils'

// Keep track of all running servers for cleanup
const activeServers: Set<http.Server | https.Server> = new Set()

/**
 * Cleanup function to close all servers and exit gracefully
 */
function cleanup() {
  debugLog('cleanup', 'Starting cleanup process')
  console.log(`\n`)
  log.info('Shutting down proxy servers...')

  const closePromises = Array.from(activeServers).map(server =>
    new Promise<void>((resolve) => {
      server.close(() => resolve())
    }),
  )

  Promise.all(closePromises).then(() => {
    debugLog('cleanup', 'All servers closed successfully')
    log.success('All proxy servers shut down successfully')
    process.exit(0)
  }).catch((err) => {
    debugLog('cleanup', `Error during cleanup: ${err.message}`)
    log.error('Error during shutdown:', err)
    process.exit(1)
  })
}

// Register cleanup handlers
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
process.on('uncaughtException', (err) => {
  debugLog('process', `Uncaught exception: ${err.message}`)
  log.error('Uncaught exception:', err)
  cleanup()
})

/**
 * Load SSL certificates from files or use provided strings
 */
async function loadSSLConfig(options: ReverseProxyOption): Promise<SSLConfig | null> {
  debugLog('ssl', 'Loading SSL configuration')

  // If HTTPS is explicitly disabled, return null
  if (options.https === false) {
    debugLog('ssl', 'HTTPS is disabled, skipping SSL configuration')
    return null
  }

  // If HTTPS is true and paths are specified, they must exist
  if (options.https === true && (options.keyPath || options.certPath)) {
    debugLog('ssl', 'Loading SSL certificates from files')
    if (!options.keyPath || !options.certPath) {
      const missing = !options.keyPath ? 'keyPath' : 'certPath'
      debugLog('ssl', `Missing required SSL path: ${missing}`)
      throw new Error(`SSL Configuration requires both keyPath and certPath. Missing: ${missing}`)
    }

    try {
      // Check if files exist
      await Promise.all([
        fs.promises.access(options.keyPath),
        fs.promises.access(options.certPath),
      ])

      // Read the files
      const [key, cert] = await Promise.all([
        fs.promises.readFile(options.keyPath, 'utf8'),
        fs.promises.readFile(options.certPath, 'utf8'),
      ])

      // If caCertPath is specified, it must exist too
      let ca: string | undefined
      if (options.caCertPath) {
        debugLog('ssl', 'Loading CA certificate')
        try {
          ca = await fs.promises.readFile(options.caCertPath, 'utf8')
        }
        catch (err) {
          debugLog('ssl', `Failed to read CA certificate: ${(err as Error).message}`)
          throw new Error(`Failed to read CA certificate: ${(err as Error).message}`)
        }
      }

      debugLog('ssl', 'SSL certificates loaded successfully')
      return { key, cert, ...(ca ? { ca } : {}) }
    }
    catch (err) {
      const error = err as NodeJS.ErrnoException
      const detail = error.code === 'ENOENT'
        ? `File not found: ${error.path}`
        : error.message

      debugLog('ssl', `SSL Configuration Error: ${detail}`)
      throw new Error(`SSL Configuration Error:\n${detail}.\nHTTPS was explicitly enabled but certificate files are missing.`)
    }
  }

  // If HTTPS is true but no paths specified, check for direct cert content
  if (options.https === true && options.key && options.cert) {
    debugLog('ssl', 'Using provided SSL certificate strings')
    return {
      key: options.key,
      cert: options.cert,
    }
  }

  // If HTTPS is true but no certificates provided at all, generate certificate
  if (options.https === true) {
    debugLog('ssl', 'Generating self-signed certificate')
    return await generateCertficate(options)
  }

  // Default to no SSL
  debugLog('ssl', 'No SSL configuration provided')
  return null
}

/**
 * Check if a port is in use
 */
function isPortInUse(port: number, hostname: string): Promise<boolean> {
  debugLog('port', `Checking if port ${port} is in use on ${hostname}`)
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        debugLog('port', `Port ${port} is in use`)
        resolve(true)
      }
    })

    server.once('listening', () => {
      debugLog('port', `Port ${port} is available`)
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
  debugLog('port', `Finding available port starting from ${startPort}`)
  let port = startPort
  while (await isPortInUse(port, hostname)) {
    debugLog('port', `Port ${port} is in use, trying ${port + 1}`)
    port++
  }
  debugLog('port', `Found available port: ${port}`)
  return port
}

/**
 * Test connection to a server
 */
async function testConnection(hostname: string, port: number): Promise<void> {
  debugLog('connection', `Testing connection to ${hostname}:${port}`)
  return new Promise<void>((resolve, reject) => {
    const socket = net.connect({
      host: hostname,
      port,
      timeout: 5000, // 5 second timeout
    })

    socket.once('connect', () => {
      debugLog('connection', `Successfully connected to ${hostname}:${port}`)
      socket.end()
      resolve()
    })

    socket.once('timeout', () => {
      debugLog('connection', `Connection to ${hostname}:${port} timed out`)
      socket.destroy()
      reject(new Error(`Connection to ${hostname}:${port} timed out`))
    })

    socket.once('error', (err) => {
      debugLog('connection', `Failed to connect to ${hostname}:${port}: ${err.message}`)
      socket.destroy()
      reject(new Error(`Failed to connect to ${hostname}:${port}: ${err.message}`))
    })
  })
}

export async function startServer(options?: ReverseProxyOption): Promise<void> {
  debugLog('server', `Starting server with options: ${JSON.stringify(options)}`)
  // Merge with default config
  const mergedOptions: ReverseProxyOption = {
    ...config,
    ...(options || {}),
  }

  const { fromUrl, toUrl, protocol } = normalizeUrls(mergedOptions)
  const fromPort = Number.parseInt(fromUrl.port) || (protocol.includes('https:') ? 443 : 80)

  debugLog('server', `Normalized URLs - From: ${fromUrl}, To: ${toUrl}, Protocol: ${protocol}`)

  // Load SSL config first to fail fast if certificates are missing
  const sslConfig = await loadSSLConfig(mergedOptions)

  // Only proceed with connection test if SSL config is properly loaded
  try {
    await testConnection(fromUrl.hostname, fromPort)
  }
  catch (err) {
    debugLog('server', `Connection test failed: ${(err as Error).message}`)
    log.error((err as Error).message)
    process.exit(1)
  }

  await setupReverseProxy({
    ...mergedOptions,
    from: fromUrl.toString(),
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
  options: ReverseProxyOption,
): Promise<void> {
  debugLog('proxy', `Creating proxy server ${from} -> ${to}`)
  const useHttps = options.https === true

  const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    debugLog('request', `${req.method} ${req.url}`)
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
      debugLog('response', `${proxyRes.statusCode} ${req.url}`)
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
      debugLog('proxy', `Proxy request failed: ${err.message}`)
      log.error('Proxy request failed:', err)
      res.writeHead(502)
      res.end(`Proxy Error: ${err.message}`)
    })

    req.pipe(proxyReq)
  }

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
      debugLog('tls', `TLS Connection - Protocol: ${tlsSocket.getProtocol?.()}, Cipher: ${tlsSocket.getCipher?.()}, Authorized: ${tlsSocket.authorized}`)
    })
  }

  activeServers.add(server)

  return new Promise((resolve, reject) => {
    server.listen(listenPort, hostname, () => {
      debugLog('server', `Server listening on port ${listenPort}`)
      console.log('')
      console.log(`  ${green(bold('reverse-proxy'))} ${green(`v${version}`)}`)
      console.log('')
      console.log(`  ${green('➜')}  ${dim(from)} ${dim('➜')} ${useHttps ? 'https' : 'http'}://${to}`)
      if (listenPort !== (useHttps ? 443 : 80))
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

    server.on('error', (err) => {
      debugLog('server', `Server error: ${(err as Error).message}`)
      reject(err)
    })
  })
}

export async function setupReverseProxy(options: ProxySetupOptions): Promise<void> {
  debugLog('setup', `Setting up reverse proxy with options: ${JSON.stringify(options)}`)
  const { from, to, fromPort, sourceUrl, ssl } = options
  const httpPort = 80
  const httpsPort = 443
  const hostname = '0.0.0.0'
  const useHttps = options.https === true

  try {
    if (useHttps && ssl) {
      debugLog('setup', 'Checking HTTP port for redirect server')
      const isHttpPortBusy = await isPortInUse(httpPort, hostname)
      if (!isHttpPortBusy) {
        debugLog('setup', 'Starting HTTP redirect server')
        startHttpRedirectServer()
      }
      else {
        debugLog('setup', 'Port 80 is in use, skipping HTTP redirect server')
        log.warn('Port 80 is in use, HTTP to HTTPS redirect will not be available')
      }
    }

    const targetPort = useHttps ? httpsPort : httpPort
    debugLog('setup', `Checking if target port ${targetPort} is available`)
    const isTargetPortBusy = await isPortInUse(targetPort, hostname)

    if (isTargetPortBusy) {
      debugLog('setup', `Target port ${targetPort} is busy, finding alternative`)
      const availablePort = await findAvailablePort(useHttps ? 8443 : 8080, hostname)
      log.warn(`Port ${targetPort} is in use. Using port ${availablePort} instead.`)
      log.info(`You can use 'sudo lsof -i :${targetPort}' (Unix) or 'netstat -ano | findstr :${targetPort}' (Windows) to check what's using the port.`)

      await createProxyServer(from, to, fromPort, availablePort, hostname, sourceUrl, ssl, options)
    }
    else {
      debugLog('setup', `Creating proxy server on port ${targetPort}`)
      await createProxyServer(from, to, fromPort, targetPort, hostname, sourceUrl, ssl, options)
    }
  }
  catch (err) {
    debugLog('setup', `Failed to setup reverse proxy: ${(err as Error).message}`)
    log.error(`Failed to setup reverse proxy: ${(err as Error).message}`)
    cleanup()
  }
}

export function startHttpRedirectServer(): void {
  debugLog('redirect', 'Starting HTTP redirect server')
  const server = http
    .createServer((req, res) => {
      const host = req.headers.host || ''
      debugLog('redirect', `Redirecting ${req.url} to https://${host}${req.url}`)
      res.writeHead(301, {
        Location: `https://${host}${req.url}`,
      })
      res.end()
    })
    .listen(80)

  activeServers.add(server)
}

export function startProxy(options?: ReverseProxyOption): void {
  debugLog('proxy', `Starting proxy with options: ${JSON.stringify(options)}`)
  const finalOptions = {
    ...config,
    ...options,
  }

  // Remove SSL-related properties if HTTPS is disabled
  if (finalOptions.https === false) {
    debugLog('proxy', 'HTTPS disabled, removing SSL options')
    delete finalOptions.keyPath
    delete finalOptions.certPath
    delete finalOptions.caCertPath
    delete finalOptions.key
    delete finalOptions.cert
  }

  log.debug('Starting proxy with options:', {
    from: finalOptions.from,
    to: finalOptions.to,
    https: finalOptions.https,
    // Only include SSL paths if HTTPS is enabled
    ...(finalOptions.https && {
      keyPath: finalOptions.keyPath,
      certPath: finalOptions.certPath,
    }),
  })

  startServer(finalOptions).catch((err) => {
    debugLog('proxy', `Failed to start proxy: ${err.message}`)
    log.error(`Failed to start proxy: ${err.message}`)
    cleanup()
  })
}

export function startProxies(options?: ReverseProxyOptions): void {
  debugLog('proxies', 'Starting multiple proxies')
  if (Array.isArray(options)) {
    debugLog('proxies', `Starting ${options.length} proxies`)
    Promise.all(options.map(option => startServer(option)))
      .catch((err) => {
        debugLog('proxies', `Failed to start proxies: ${err.message}`)
        log.error('Failed to start proxies:', err)
        cleanup()
      })
  }
  else if (options) {
    debugLog('proxies', 'Starting single proxy')
    startServer(options).catch((err) => {
      debugLog('proxies', `Failed to start proxy: ${err.message}`)
      log.error('Failed to start proxy:', err)
      cleanup()
    })
  }
}

/**
 * Create normalized URLs with correct protocol
 */
function normalizeUrls(options: ReverseProxyOption) {
  debugLog('urls', 'Normalizing URLs')
  const useHttps = options.https === true
  const protocol = useHttps ? 'https://' : 'http://'

  // Use default values if from/to are undefined
  const fromString = options.from || 'localhost:5173'
  const toString = options.to || 'stacks.localhost'

  debugLog('urls', `Original URLs - From: ${fromString}, To: ${toString}`)

  const fromUrl = new URL(fromString.startsWith('http')
    ? fromString
    : `${protocol}${fromString}`)

  const toUrl = new URL(toString.startsWith('http')
    ? toString
    : `${protocol}${toString}`)

  debugLog('urls', `Normalized URLs - From: ${fromUrl}, To: ${toUrl}, Protocol: ${protocol}`)

  return {
    fromUrl,
    toUrl,
    protocol,
  }
}
