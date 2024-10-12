import * as http from 'node:http'
import * as net from 'node:net'
import { bold, dim, green, log } from '@stacksjs/cli'
import { version } from '../package.json'
import type { ReverseProxyOption, ReverseProxyOptions } from './types'

export async function startServer(
  options: ReverseProxyOption = { from: 'localhost:3000', to: 'stacks.localhost' },
): Promise<void> {
  log.debug('Starting Reverse Proxy Server', options)

  // Parse the option.from URL to dynamically set hostname and port
  const fromUrl = new URL(
    options.from
      ? options.from.startsWith('http')
        ? options.from
        : `http://${options.from}`
      : 'http://localhost:3000',
  )
  const hostname = fromUrl.hostname
  const port = Number.parseInt(fromUrl.port) || (fromUrl.protocol === 'https:' ? 443 : 80)

  // Attempt to connect to the specified host and port
  const socket = net.connect(port, hostname, () => {
    log.debug(`Successfully connected to ${options.from}`)
    socket.end()

    // Proceed with setting up the reverse proxy after successful connection
    setupReverseProxy({ ...options, hostname, port })
  })

  socket.on('error', (err) => {
    log.error(`Failed to connect to ${options.from}: ${err.message}`)
    throw new Error(`Cannot start reverse proxy because ${options.from} is unreachable.`)
  })
}

export function setupReverseProxy(options: ReverseProxyOption): void {
  log.debug('setupReverseProxy', options)

  const { hostname, port, from, to } = options

  // Check if port 80 is in use
  const testServer = net.createServer()
  testServer.once('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      log.error(`Port 80 is already in use. Please check for other services using this port.`)
      log.info(`You can use 'sudo lsof -i :80' to see which process is using port 80.`)
      process.exit(1)
    }
  })

  testServer.once('listening', () => {
    testServer.close(() => {
      // Port is free, proceed with setting up the reverse proxy
      const httpServer = http.createServer((req, res) => {
        // Define the target server's options
        const options = {
          hostname,
          port,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: `${hostname}:${port}` }, // Update the host header
        }

        // Create a request to the target server
        const proxyReq = http.request(options, (proxyRes) => {
          // Set the statusCode and headers from the proxied response
          res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
          // Pipe the proxied response's body directly to the original response
          proxyRes.pipe(res, { end: true })
        })

        // Pipe the original request body directly to the proxied request
        req.pipe(proxyReq, { end: true })

        // Handle errors
        proxyReq.on('error', (err) => {
          console.error('Proxy to server error:', err)
          res.writeHead(500)
          res.end('Proxy error')
        })
      })

      httpServer.listen(80, '0.0.0.0', () => {
        console.log('')
        console.log(`  ${green(bold('reverse-proxy'))} ${green(`v${version}`)}`)
        console.log('')
        console.log(`  ${green('➜')}  ${dim(from as string)} ${dim('➜')} http://${to}`)
      })
    })
  })

  testServer.listen(80, '0.0.0.0')
}

export function startHttpRedirectServer(): void {
  http
    .createServer((req, res) => {
      res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` })
      res.end()
    })
    .listen(80)
}

export function startProxy(option?: ReverseProxyOption): void {
  startServer(option)
}

export function startProxies(options?: ReverseProxyOptions): void {
  if (Array.isArray(options)) {
    options.forEach((option: ReverseProxyOption) => {
      startServer(option)
    })
  } else {
    startServer(options)
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
