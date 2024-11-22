/* eslint-disable no-console */
import type { SecureServerOptions } from 'node:http2'
import type { ServerOptions } from 'node:https'
import type { CleanupOptions, MultiReverseProxyConfig, ProxySetupOptions, ReverseProxyConfigs, ReverseProxyOption, ReverseProxyOptions, SingleReverseProxyConfig, SSLConfig } from './types'
import * as fs from 'node:fs'
import * as http from 'node:http'
import * as https from 'node:https'
import * as net from 'node:net'
import process from 'node:process'
import { bold, dim, green, log } from '@stacksjs/cli'
import { version } from '../package.json'
import { addHosts, checkHosts, removeHosts } from './hosts'
import { generateCertificate, getSSLConfig, httpsConfig } from './https'
import { debugLog, extractDomains } from './utils'

// Keep track of all running servers for cleanup
const activeServers: Set<http.Server | https.Server> = new Set()

/**
 * Cleanup function to close all servers and cleanup hosts file if configured
 */
export async function cleanup(options?: CleanupOptions): Promise<void> {
  debugLog('cleanup', 'Starting cleanup process', options?.verbose)
  console.log(`\n`)
  log.info('Shutting down proxy servers...')

  // Create an array to store all cleanup promises
  const cleanupPromises: Promise<void>[] = []

  // Add server closing promises
  const serverClosePromises = Array.from(activeServers).map(server =>
    new Promise<void>((resolve) => {
      server.close(() => {
        debugLog('cleanup', 'Server closed successfully', options?.verbose)
        resolve()
      })
    }),
  )
  cleanupPromises.push(...serverClosePromises)

  // Add hosts file cleanup if configured
  if (options?.etcHostsCleanup && options.domains?.length) {
    debugLog('cleanup', 'Cleaning up hosts file entries', options?.verbose)

    const domainsToClean = options.domains.filter(domain => !domain.includes('localhost'))

    if (domainsToClean.length > 0) {
      log.info('Cleaning up hosts file entries...')
      cleanupPromises.push(
        removeHosts(domainsToClean, options?.verbose)
          .then(() => {
            debugLog('cleanup', `Removed hosts entries for ${domainsToClean.join(', ')}`, options?.verbose)
          })
          .catch((err) => {
            debugLog('cleanup', `Failed to remove hosts entries: ${err}`, options?.verbose)
            log.warn(`Failed to clean up hosts file entries for ${domainsToClean.join(', ')}:`, err)
          }),
      )
    }
  }

  try {
    await Promise.all(cleanupPromises)
    debugLog('cleanup', 'All cleanup tasks completed successfully', options?.verbose)
    log.success('All cleanup tasks completed successfully')
    process.exit(0)
  }
  catch (err) {
    debugLog('cleanup', `Error during cleanup: ${err}`, options?.verbose)
    log.error('Error during cleanup:', err)
    process.exit(1)
  }
}

// Register cleanup handlers
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
process.on('uncaughtException', (err) => {
  debugLog('process', `Uncaught exception: ${err}`, true)
  log.error('Uncaught exception:', err)
  cleanup()
})

/**
 * Load SSL certificates from files or use provided strings
 */
async function loadSSLConfig(options: ReverseProxyOption): Promise<SSLConfig | null> {
  debugLog('ssl', `Loading SSL configuration`, options.verbose)

  if (options.https === true)
    options.https = httpsConfig(options)
  else if (options.https === false)
    return null

  // Early return for non-SSL configuration
  if (!options.https?.keyPath && !options.https?.certPath) {
    debugLog('ssl', 'No SSL configuration provided', options.verbose)
    return null
  }

  if ((options.https?.keyPath && !options.https?.certPath) || (!options.https?.keyPath && options.https?.certPath)) {
    const missing = !options.https?.keyPath ? 'keyPath' : 'certPath'
    debugLog('ssl', `Invalid SSL configuration - missing ${missing}`, options.verbose)
    throw new Error(`SSL Configuration requires both keyPath and certPath. Missing: ${missing}`)
  }

  try {
    if (!options.https?.keyPath || !options.https?.certPath)
      return null

    // Try to read existing certificates
    try {
      debugLog('ssl', 'Reading SSL certificate files', options.verbose)
      const key = await fs.promises.readFile(options.https?.keyPath, 'utf8')
      const cert = await fs.promises.readFile(options.https?.certPath, 'utf8')

      debugLog('ssl', 'SSL configuration loaded successfully', options.verbose)
      return { key, cert }
    }
    catch (error) {
      debugLog('ssl', `Failed to read certificates: ${error}`, options.verbose)
      return null
    }
  }
  catch (err) {
    debugLog('ssl', `SSL configuration error: ${err}`, options.verbose)
    throw err
  }
}

/**
 * Check if a port is in use
 */
function isPortInUse(port: number, hostname: string, verbose?: boolean): Promise<boolean> {
  debugLog('port', `Checking if port ${port} is in use on ${hostname}`, verbose)
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        debugLog('port', `Port ${port} is in use`, verbose)
        resolve(true)
      }
    })

    server.once('listening', () => {
      debugLog('port', `Port ${port} is available`, verbose)
      server.close()
      resolve(false)
    })

    server.listen(port, hostname)
  })
}

/**
 * Find next available port
 */
async function findAvailablePort(startPort: number, hostname: string, verbose?: boolean): Promise<number> {
  debugLog('port', `Finding available port starting from ${startPort}`, verbose)
  let port = startPort
  while (await isPortInUse(port, hostname, verbose)) {
    debugLog('port', `Port ${port} is in use, trying ${port + 1}`, verbose)
    port++
  }
  debugLog('port', `Found available port: ${port}`, verbose)
  return port
}

/**
 * Test connection to a server
 */
async function testConnection(hostname: string, port: number, verbose?: boolean): Promise<void> {
  debugLog('connection', `Testing connection to ${hostname}:${port}`, verbose)
  return new Promise<void>((resolve, reject) => {
    const socket = net.connect({
      host: hostname,
      port,
      timeout: 5000, // 5 second timeout
    })

    socket.once('connect', () => {
      debugLog('connection', `Successfully connected to ${hostname}:${port}`, verbose)
      socket.end()
      resolve()
    })

    socket.once('timeout', () => {
      debugLog('connection', `Connection to ${hostname}:${port} timed out`, verbose)
      socket.destroy()
      reject(new Error(`Connection to ${hostname}:${port} timed out`))
    })

    socket.once('error', (err) => {
      debugLog('connection', `Failed to connect to ${hostname}:${port}: ${err}`, verbose)
      socket.destroy()
      reject(new Error(`Failed to connect to ${hostname}:${port}: ${err.message}`))
    })
  })
}

export async function startServer(options: SingleReverseProxyConfig): Promise<void> {
  debugLog('server', `Starting server with options: ${JSON.stringify(options)}`, options.verbose)

  // Parse URLs early to get the hostnames
  const fromUrl = new URL(options.from.startsWith('http') ? options.from : `http://${options.from}`)
  const toUrl = new URL(options.to.startsWith('http') ? options.to : `http://${options.to}`)
  const fromPort = Number.parseInt(fromUrl.port) || (fromUrl.protocol.includes('https:') ? 443 : 80)

  // Check and update hosts file for custom domains
  const hostsToCheck = [toUrl.hostname]
  if (!toUrl.hostname.includes('localhost') && !toUrl.hostname.includes('127.0.0.1')) {
    debugLog('hosts', `Checking if hosts file entry exists for: ${toUrl.hostname}`, options?.verbose)

    try {
      const hostsExist = await checkHosts(hostsToCheck, options.verbose)
      if (!hostsExist[0]) {
        log.info(`Adding ${toUrl.hostname} to hosts file...`)
        log.info('This may require sudo/administrator privileges')
        try {
          await addHosts(hostsToCheck, options.verbose)
        }
        catch (addError) {
          log.error('Failed to add hosts entry:', (addError as Error).message)
          log.warn('You can manually add this entry to your hosts file:')
          log.warn(`127.0.0.1 ${toUrl.hostname}`)
          log.warn(`::1 ${toUrl.hostname}`)

          if (process.platform === 'win32') {
            log.warn('On Windows:')
            log.warn('1. Run notepad as administrator')
            log.warn('2. Open C:\\Windows\\System32\\drivers\\etc\\hosts')
          }
          else {
            log.warn('On Unix systems:')
            log.warn('sudo nano /etc/hosts')
          }
        }
      }
      else {
        debugLog('hosts', `Host entry already exists for ${toUrl.hostname}`, options.verbose)
      }
    }
    catch (checkError) {
      log.error('Failed to check hosts file:', (checkError as Error).message)
      // Continue with proxy setup even if hosts check fails
    }
  }

  // Test connection to source server before proceeding
  try {
    await testConnection(fromUrl.hostname, fromPort, options.verbose)
  }
  catch (err) {
    debugLog('server', `Connection test failed: ${err}`, options.verbose)
    log.error((err as Error).message)
    process.exit(1)
  }

  let sslConfig = options._cachedSSLConfig || null

  if (options.https) {
    try {
      if (options.https === true) {
        options.https = httpsConfig({
          ...options,
          to: toUrl.hostname,
        })
      }

      // Try to load existing certificates
      try {
        debugLog('ssl', `Attempting to load SSL configuration for ${toUrl.hostname}`, options.verbose)
        sslConfig = await loadSSLConfig({
          ...options,
          to: toUrl.hostname,
          https: options.https,
        })
      }
      catch (loadError) {
        debugLog('ssl', `Failed to load certificates, will generate new ones: ${loadError}`, options.verbose)
      }

      // Generate new certificates if loading failed or returned null
      if (!sslConfig) {
        debugLog('ssl', `Generating new certificates for ${toUrl.hostname}`, options.verbose)
        await generateCertificate({
          ...options,
          from: fromUrl.toString(),
          to: toUrl.hostname,
          https: options.https,
        })

        // Try loading again after generation
        sslConfig = await loadSSLConfig({
          ...options,
          to: toUrl.hostname,
          https: options.https,
        })

        if (!sslConfig) {
          throw new Error(`Failed to load SSL configuration after generating certificates for ${toUrl.hostname}`)
        }
      }
    }
    catch (err) {
      debugLog('server', `SSL setup failed: ${err}`, options.verbose)
      throw err
    }
  }

  debugLog('server', `Setting up reverse proxy with SSL config for ${toUrl.hostname}`, options.verbose)

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
  verbose?: boolean,
): Promise<void> {
  debugLog('proxy', `Creating proxy server ${from} -> ${to}`, verbose)

  const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    debugLog('request', `Incoming request: ${req.method} ${req.url}`, verbose)

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

    debugLog('request', `Proxy request options: ${JSON.stringify(proxyOptions)}`, verbose)

    const proxyReq = http.request(proxyOptions, (proxyRes) => {
      debugLog('response', `Proxy response received with status ${proxyRes.statusCode}`, verbose)

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
      debugLog('request', `Proxy request failed: ${err}`, verbose)
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

  debugLog('server', `Creating server with SSL config: ${!!ssl}`, verbose)

  const server = ssl && serverOptions
    ? https.createServer(serverOptions, requestHandler)
    : http.createServer(requestHandler)

  if (ssl) {
    server.on('secureConnection', (tlsSocket) => {
      debugLog('tls', `TLS Connection established: ${JSON.stringify({
        protocol: tlsSocket.getProtocol?.(),
        cipher: tlsSocket.getCipher?.(),
        authorized: tlsSocket.authorized,
        authError: tlsSocket.authorizationError,
      })}`, verbose)
    })
  }

  activeServers.add(server)

  return new Promise((resolve, reject) => {
    server.listen(listenPort, hostname, () => {
      debugLog('server', `Server listening on port ${listenPort}`, verbose)

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

    server.on('error', (err) => {
      debugLog('server', `Server error: ${err}`, verbose)
      reject(err)
    })
  })
}

export async function setupReverseProxy(options: ProxySetupOptions): Promise<void> {
  debugLog('setup', `Setting up reverse proxy: ${JSON.stringify(options)}`, options.verbose)

  const { from, to, fromPort, sourceUrl, ssl, verbose, etcHostsCleanup, portManager } = options
  const httpPort = 80
  const httpsPort = 443
  const hostname = '0.0.0.0'

  try {
    // Handle HTTP redirect server only for the first proxy
    if (ssl && !portManager?.usedPorts.has(httpPort)) {
      const isHttpPortBusy = await isPortInUse(httpPort, hostname, verbose)
      if (!isHttpPortBusy) {
        debugLog('setup', 'Starting HTTP redirect server', verbose)
        startHttpRedirectServer(verbose)
        portManager?.usedPorts.add(httpPort)
      }
      else {
        debugLog('setup', 'Port 80 is in use, skipping HTTP redirect', verbose)
        log.warn('Port 80 is in use, HTTP to HTTPS redirect will not be available')
      }
    }

    const targetPort = ssl ? httpsPort : httpPort
    let finalPort: number

    if (portManager) {
      finalPort = await portManager.getNextAvailablePort(targetPort)
    }
    else {
      const isTargetPortBusy = await isPortInUse(targetPort, hostname, verbose)
      finalPort = isTargetPortBusy
        ? await findAvailablePort(ssl ? 8443 : 8080, hostname, verbose)
        : targetPort
    }

    if (finalPort !== targetPort) {
      log.warn(`Port ${targetPort} is in use. Using port ${finalPort} instead.`)
      log.info(`You can use 'sudo lsof -i :${targetPort}' (Unix) or 'netstat -ano | findstr :${targetPort}' (Windows) to check what's using the port.`)
    }

    await createProxyServer(from, to, fromPort, finalPort, hostname, sourceUrl, ssl, verbose)
  }
  catch (err) {
    debugLog('setup', `Setup failed: ${err}`, verbose)
    log.error(`Failed to setup reverse proxy: ${(err as Error).message}`)
    cleanup({
      domains: [to],
      etcHostsCleanup,
      verbose,
    })
  }
}

export function startHttpRedirectServer(verbose?: boolean): void {
  debugLog('redirect', 'Starting HTTP redirect server', verbose)

  const server = http
    .createServer((req, res) => {
      const host = req.headers.host || ''
      debugLog('redirect', `Redirecting request from ${host}${req.url} to HTTPS`, verbose)
      res.writeHead(301, {
        Location: `https://${host}${req.url}`,
      })
      res.end()
    })
    .listen(80)
  activeServers.add(server)
  debugLog('redirect', 'HTTP redirect server started', verbose)
}

export function startProxy(options: ReverseProxyOption): void {
  debugLog('proxy', `Starting proxy with options: ${JSON.stringify(options)}`, options?.verbose)

  const serverOptions: SingleReverseProxyConfig = {
    from: options?.from || 'localhost:5173',
    to: options?.to || 'stacks.localhost',
    https: httpsConfig(options),
    etcHostsCleanup: options?.etcHostsCleanup || false,
    verbose: options?.verbose || false,
  }

  console.log('serverOptions', serverOptions)

  startServer(serverOptions).catch((err) => {
    debugLog('proxy', `Failed to start proxy: ${err}`, options.verbose)
    log.error(`Failed to start proxy: ${err.message}`)
    cleanup({
      domains: [options.to],
      etcHostsCleanup: options.etcHostsCleanup,
      verbose: options.verbose,
    })
  })
}

export async function startProxies(options?: ReverseProxyOptions): Promise<void> {
  if (!options)
    return

  debugLog('proxies', 'Starting proxies setup', isMultiProxyConfig(options) ? options.verbose : options.verbose)

  if (options.https) {
    await generateCertificate(options as ReverseProxyConfigs)
  }

  // Convert configurations to a flat array of proxy configs
  const proxyOptions = isMultiProxyConfig(options)
    ? options.proxies.map(proxy => ({
      ...proxy,
      https: options.https,
      etcHostsCleanup: options.etcHostsCleanup,
      verbose: options.verbose,
      _cachedSSLConfig: options._cachedSSLConfig,
    }))
    : [options]

  // Extract all domains for cleanup
  const domains = extractDomains(options as ReverseProxyConfigs)
  const sslConfig = options.https ? getSSLConfig() : null

  // Setup cleanup handler with all domains
  const cleanupHandler = () => cleanup({
    domains,
    etcHostsCleanup: isMultiProxyConfig(options) ? options.etcHostsCleanup : options.etcHostsCleanup || false,
    verbose: isMultiProxyConfig(options) ? options.verbose : options.verbose || false,
  })

  // Register cleanup handlers
  process.on('SIGINT', cleanupHandler)
  process.on('SIGTERM', cleanupHandler)
  process.on('uncaughtException', (err) => {
    debugLog('process', `Uncaught exception: ${err}`, true)
    log.error('Uncaught exception:', err)
    cleanupHandler()
  })

  // Now start all proxies with the cached SSL config
  for (const option of proxyOptions) {
    try {
      const domain = option.to || 'stacks.localhost'
      debugLog('proxy', `Starting proxy for ${domain} with SSL config: ${!!sslConfig}`, option.verbose)

      await startServer({
        from: option.from || 'localhost:5173',
        to: domain,
        https: option.https ?? false,
        etcHostsCleanup: option.etcHostsCleanup || false,
        verbose: option.verbose || false,
        _cachedSSLConfig: sslConfig,
      })
    }
    catch (err) {
      debugLog('proxies', `Failed to start proxy for ${option.to}: ${err}`, option.verbose)
      log.error(`Failed to start proxy for ${option.to}:`, err)
      cleanupHandler()
    }
  }
}

function isMultiProxyConfig(options: ReverseProxyConfigs): options is MultiReverseProxyConfig {
  return 'proxies' in options
}
