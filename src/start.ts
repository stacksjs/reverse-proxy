/* eslint-disable no-console */
import type { ReverseProxyOption, ReverseProxyOptions } from './types'
import * as http from 'node:http'
import * as net from 'node:net'
import process from 'node:process'
import { bold, dim, green, log } from '@stacksjs/cli'
import { version } from '../package.json'
import { config } from './config'

// Keep track of all running servers for cleanup
const activeServers: Set<http.Server> = new Set()

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
  return new Promise((resolve, reject) => {
    const socket = net.connect({
      host: hostname,
      port,
      timeout: 5000, // 5 second timeout
    }, () => {
      socket.end()
      resolve()
    })

    socket.on('error', (err) => {
      socket.destroy()
      reject(err)
    })

    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('Connection timed out'))
    })
  })
}

export async function startServer(options: ReverseProxyOption): Promise<void> {
  log.debug('Starting Reverse Proxy Server', options)

  if (!options.from)
    options.from = config.from
  if (!options.to)
    options.to = config.to

  // Ensure URLs have protocols
  if (!options.from.startsWith('http://') && !options.from.startsWith('https://'))
    options.from = `http://${options.from}`

  if (!options.to.startsWith('http://') && !options.to.startsWith('https://'))
    options.to = `http://${options.to}`

  const fromUrl = new URL(options.from)
  const toUrl = new URL(options.to)

  const fromPort = Number.parseInt(fromUrl.port) || (fromUrl.protocol.includes('https:') ? 443 : 80)

  try {
    // Test connection to source server
    await testConnection(fromUrl.hostname, fromPort)
    log.debug(`Successfully connected to source server at ${options.from}`)

    await setupReverseProxy({
      ...options,
      to: toUrl.hostname,
      fromPort,
      sourceUrl: fromUrl,
    })
  }
  catch (err) {
    log.error(`Failed to connect to source server at ${options.from}`)
    log.error(`Error: ${(err as Error).message}`)
    throw new Error(`Cannot start reverse proxy because ${options.from} is unreachable.`)
  }
}

export async function setupReverseProxy(options: ReverseProxyOption & {
  fromPort: number
  sourceUrl: URL
}): Promise<void> {
  const { from, to, fromPort, sourceUrl } = options
  const listenPort = 80
  const hostname = '0.0.0.0'

  try {
    const isPortBusy = await isPortInUse(listenPort, hostname)

    if (isPortBusy) {
      const availablePort = await findAvailablePort(8080, hostname)
      log.warn(`Port ${listenPort} is in use. Using port ${availablePort} instead.`)
      log.info(`You can use 'sudo lsof -i :80' (Unix) or 'netstat -ano | findstr :80' (Windows) to check what's using port 80.`)

      await createProxyServer(from, to, fromPort, availablePort, hostname, sourceUrl)
    }
    else {
      await createProxyServer(from, to, fromPort, listenPort, hostname, sourceUrl)
    }
  }
  catch (err) {
    log.error(`Failed to setup reverse proxy: ${(err as Error).message}`)
    cleanup()
  }
}

async function createProxyServer(
  from: string,
  to: string,
  fromPort: number,
  listenPort: number,
  hostname: string,
  sourceUrl: URL,
): Promise<void> {
  const server = http.createServer((req, res) => {
    const proxyOptions = {
      hostname: sourceUrl.hostname,
      port: fromPort,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: sourceUrl.host, // Use original host with port if present
      },
    }

    log.debug('Proxy request:', {
      url: req.url,
      method: req.method,
      target: `${sourceUrl.hostname}:${fromPort}`,
    })

    const proxyReq = http.request(proxyOptions, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
      proxyRes.pipe(res, { end: true })
    })

    proxyReq.on('error', (err) => {
      log.error('Proxy request failed:', err.message)
      res.writeHead(502)
      res.end(`Proxy Error: ${err.message}`)
    })

    req.on('error', (err) => {
      log.error('Client request error:', err.message)
      res.writeHead(400)
      res.end(`Client Error: ${err.message}`)
    })

    req.pipe(proxyReq, { end: true })
  })

  server.on('error', (err) => {
    log.error(`Server error: ${err.message}`)
    throw err
  })

  // Add to active servers set
  activeServers.add(server)

  return new Promise((resolve, reject) => {
    server.listen(listenPort, hostname, () => {
      console.log('')
      console.log(`  ${green(bold('reverse-proxy'))} ${green(`v${version}`)}`)
      console.log('')
      console.log(`  ${green('➜')}  ${dim(from)} ${dim('➜')} http://${to}`)
      if (listenPort !== 80)
        console.log(`  ${green('➜')}  Listening on port ${listenPort}`)

      resolve()
    })

    server.on('error', reject)
  })
}

export function startHttpRedirectServer(): void {
  const server = http
    .createServer((req, res) => {
      res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` })
      res.end()
    })
    .listen(80)

  activeServers.add(server)
}

export function startProxy(option?: ReverseProxyOption): void {
  if (!option)
    option = config

  startServer(option).catch((err) => {
    log.error('Failed to start proxy:', err)
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
  else {
    startServer(options).catch((err) => {
      log.error('Failed to start proxy:', err)
      cleanup()
    })
  }
}

// export async function ensureCertificates(option: Option): Promise<{ key: Buffer, cert: Buffer }> {
//   const sslBasePath = path.homeDir('.stacks/ssl')
//   const keysPath = path.resolve(sslBasePath, 'keys')
//   await fs.promises.mkdir(keysPath, { recursive: true })

//   const keyPath = option.keyPath ?? path.resolve(keysPath, `${option.to}.key`)
//   const certPath = option.certPath ?? path.resolve(keysPath, `${option.to}.crt`)

//   let key: Buffer | undefined
//   let cert: Buffer | undefined

//   try {
//     key = await fs.promises.readFile(keyPath)
//     cert = await fs.promises.readFile(certPath)
//   }
//   catch (error) {
//     log.info('A valid SSL key & certificate was not found, creating a self-signed certificate...')
//     await generateAndSaveCertificates()
//     await addRootCAToSystemTrust()

//     key = await fs.promises.readFile(keyPath)
//     cert = await fs.promises.readFile(certPath)
//   }

//   return { key, cert }
// }
