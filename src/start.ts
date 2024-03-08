import * as net from 'node:net'
import * as http from 'node:http'
import * as https from 'node:https'
import * as fs from 'node:fs'
import type { Buffer } from 'node:buffer'
import { path } from '@stacksjs/path'
import { bold, dim, green, log } from '@stacksjs/cli'
import { version } from '../package.json'
import { generateAndSaveCertificates, addRootCAToSystemTrust } from './keys'

export interface Option {
  from?: string // domain to proxy from, defaults to localhost:3000
  to?: string // domain to proxy to, defaults to stacks.localhost
  keyPath?: string // absolute path to the key
  certPath?: string // absolute path to the cert
  httpsRedirect?: boolean // redirect http to https, defaults to true
}

type Options = Option | Option[]

export async function startServer(option: Option = { from: 'localhost:3000', to: 'stacks.localhost' }): Promise<void> {
  log.debug('Starting Reverse Proxy Server')

  // Ensure the SSL key and certificate exist
  const { key, cert } = await ensureCertificates(option)

  // Parse the option.from URL to dynamically set hostname and port
  const fromUrl = new URL(option.from ? (option.from.startsWith('http') ? option.from : `http://${option.from}`) : 'http://localhost:3000')
  const hostname = fromUrl.hostname
  const port = Number.parseInt(fromUrl.port) || (fromUrl.protocol === 'https:' ? 443 : 80)

  // Attempt to connect to the specified host and port
  const socket = net.connect(port, hostname, () => {
    log.debug(`Successfully connected to ${option.from}`)
    socket.end()

    // Proceed with setting up the reverse proxy after successful connection
    setupReverseProxy({ key, cert, hostname, port, option })
  })

  socket.on('error', (err) => {
    log.error(`Failed to connect to ${option.from}: ${err.message}`)
    throw new Error(`Cannot start reverse proxy because ${option.from} is unreachable.`)
  })
}

export function setupReverseProxy({ key, cert, hostname, port, option }: { key?: Buffer, cert?: Buffer, hostname: string, port: number, option: Option }): void {
  // This server will act as a reverse proxy
  const httpsServer = https.createServer({ key, cert }, (req, res) => {
    // Define the target server's options
    const options = {
      hostname,
      port,
      path: req.url,
      method: req.method,
      headers: req.headers,
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

  httpsServer.listen(443, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log('')
    // eslint-disable-next-line no-console
    console.log(`  ${green(bold('reverse-proxy'))} ${green(`v${version}`)}`)
    // eslint-disable-next-line no-console
    console.log('')
    // eslint-disable-next-line no-console
    console.log(`  ${green('➜')}  ${dim(option.from!)} ${dim('➜')} https://${option.to}`)
  })

  // http to https redirect
  if (option.httpsRedirect ?? true)
    startHttpRedirectServer()
}

export function startHttpRedirectServer(): void {
  http.createServer((req, res) => {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` })
    res.end()
  }).listen(80)
}

export function startProxy(option?: Option): void {
  startServer(option)
}

export function startProxies(options?: Options): void {
  if (Array.isArray(options)) {
    options.forEach((option: Option) => {
      startServer(option)
    })
  }
  else {
    startServer(options)
  }
}

export async function ensureCertificates(option: Option): Promise<{ key: Buffer, cert: Buffer }> {
  const sslBasePath = path.homeDir('.stacks/ssl')
  const keysPath = path.resolve(sslBasePath, 'keys')
  await fs.promises.mkdir(keysPath, { recursive: true })

  const keyPath = option.keyPath ?? path.resolve(keysPath, `${option.to}.key`)
  const certPath = option.certPath ?? path.resolve(keysPath, `${option.to}.crt`)

  let key: Buffer | undefined
  let cert: Buffer | undefined

  try {
    key = await fs.promises.readFile(keyPath)
    cert = await fs.promises.readFile(certPath)
  }
  catch (error) {
    log.info('A valid SSL key & certificate was not found, creating a self-signed certificate...')
    await generateAndSaveCertificates()
    await addRootCAToSystemTrust()

    key = await fs.promises.readFile(keyPath)
    cert = await fs.promises.readFile(certPath)
  }

  return { key, cert }
}
