import * as net from 'node:net'
import * as http from 'node:http'
import * as https from 'node:https'
import { bold, dim, green, log } from '@stacksjs/cli'
import { version } from '../package.json'

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

  // Parse the option.from URL to dynamically set hostname and port
  const fromUrl = new URL(option.from ? (option.from.startsWith('http') ? option.from : `http://${option.from}`) : 'http://localhost:3000')
  const hostname = fromUrl.hostname
  const port = Number.parseInt(fromUrl.port) || (fromUrl.protocol === 'https:' ? 443 : 80)

  // Attempt to connect to the specified host and port
  const socket = net.connect(port, hostname, () => {
    log.debug(`Successfully connected to ${option.from}`)
    socket.end()

    const cert = '-----BEGIN CERTIFICATE-----\r\nMIIDBjCCAe6gAwIBAgIUAdYO7vc82qKcT2DJn7WXylTNN6kwDQYJKoZIhvcNAQEF\r\nBQAwLTELMAkGA1UEBhMCQVUxEzARBgNVBAgTClNvbWUtU3RhdGUxCTAHBgNVBAoT\r\nADAeFw0yNDAzMDkxNzUwMjZaFw0yNDAzMTAxNzUwMjZaMC0xCzAJBgNVBAYTAkFV\r\nMRMwEQYDVQQIEwpTb21lLVN0YXRlMQkwBwYDVQQKEwAwggEiMA0GCSqGSIb3DQEB\r\nAQUAA4IBDwAwggEKAoIBAQC0Nl+n9xusat7FvFn/7/NEXDn35I/T0cAiwesBbDDo\r\neXtM/iOfvTRqYS+1Kca9byC4kFuFW7cO8gsihHb2bV6YjgLkuDGYsJBfgiGVyytu\r\n+Qjm2pnsvExffWR7Z1E4v6XUm5q1p5u733jjW2Cr2Px3fzHQ3TWuAml6SyN53E57\r\nwieY1Thw2QrhG8rUxTTc140FRxaWwEMbQy5tLZXIuNy0HrcVUbmM7172ZCep997+\r\nBx+Pd7toDIuiXqS6x98Ilqv2Pa8496cnNv+jAq383bcKSCjcpRizUHH2TK7SHcNu\r\ngevBIcNuK1nZvyEgrouvG1iQUBgkV3HDGKpF3eR8JuZVAgMBAAGjHjAcMBoGA1Ud\r\nEQQTMBGGCWxvY2FsaG9zdIcEfwAAATANBgkqhkiG9w0BAQUFAAOCAQEAk0CEKSL4\r\n5TR4Z3W4yoZlHDl2ddS/uqBT6Y0hOgWqN4W9P5xow9qSZpFPr2sky7nl2xP0QR84\r\ns6oOc4/WB4RrzTxBK0ktCWok6a4apMpkdUQeYWb1eevWVSYfTp+8W8/zCJ5xW89P\r\n4nTBc9mn8wYSg4I9d2w/sGilpPNj+iahHZ4/nSpZAHN1mhz6+9LfyQuwDlMni5rG\r\nl8R/cebuzNydu5qnpwg/bS1HBzbcclM32dANGFGX0NZEs7JKh5An4z+HnHpfLwoq\r\nZvoq0xKjnQ5Xct1eKu1cBWKLJybMtI8xkcf1WhfDHGiHhhQVgLuFztDmkcDVNxua\r\nCzPXD00akRuNVg==\r\n-----END CERTIFICATE-----\r\n'
    const key = '-----BEGIN RSA PRIVATE KEY-----\r\nMIIEogIBAAKCAQEAtDZfp/cbrGrexbxZ/+/zRFw59+SP09HAIsHrAWww6Hl7TP4j\r\nn700amEvtSnGvW8guJBbhVu3DvILIoR29m1emI4C5LgxmLCQX4IhlcsrbvkI5tqZ\r\n7LxMX31ke2dROL+l1Juataebu99441tgq9j8d38x0N01rgJpeksjedxOe8InmNU4\r\ncNkK4RvK1MU03NeNBUcWlsBDG0MubS2VyLjctB63FVG5jO9e9mQnqffe/gcfj3e7\r\naAyLol6kusffCJar9j2vOPenJzb/owKt/N23Ckgo3KUYs1Bx9kyu0h3DboHrwSHD\r\nbitZ2b8hIK6LrxtYkFAYJFdxwxiqRd3kfCbmVQIDAQABAoIBAACi9oiJ22uq/vl0\r\n1l6Mku/pYX0KLiXh5ktZIwLgxnVzxGc7uJV+XhqIGFqL+Ls/kr6EKAabEdT4Luji\r\nzebF8SEZ01HKgsZWzVPBCmxUiOU99PWXzRZkfeKSd1HmRgesyaGsIQpGOssZmXw4\r\nHOnOfOnRJbRmq6NfN88qR8hM6mwOfHzA28+0lLLrqcR/2sHSC9S91RZhjFp/bJ4J\r\nftaTNeYVo8AeY9AozLl+JI1z7KaovkKdNTFaqEXJEeiYY6XilbS4EGi3ZMh5a4f7\r\ndsaRueEWr+OIHqHpbk3yJVI5NXJz2Z+Pmm4yinsC+ZF+ADaw0j4a258SKO9Nc7A9\r\nF1vY20ECgYEA87Ms2xS9lxtsRerg/Z/SSoe+8y5vppfMTEZPFdwjJZz4K9lOWHnL\r\nxBTwvQEiyv5u5ygI6yLHTmhIZkh4DK3CUNQyFlU2le0xHjiFwxFU9JQTjDRHrwaL\r\nGbhTISUkYPJFPUGPMa8KWSFqBMl0BC9gu/weCSRdaNDrzeDXb+pKHPUCgYEAvU7h\r\ny99EeUy/5gwJh8VBXCjBRxxqVsuW00QMh5ZGrV1UEMEcVfZDP+ELaxtPtekKw1f8\r\nktQWp3M2GTftIjllrBNe8ibgB/kbcC0eowEYkx2qaHEQYD2QlBfg7gcQ+LMzMr5a\r\nu/0WTPbcfJWhsmogbAECQfJlS1Zg2FBCEAHdx+ECgYAgpvgynnPMpEr8jzz4Horh\r\nm5CVKrqg+qPP8He2ORmod4C091fM+Py5WAjtehJ8WlznsfCH+M/1jHlu4vTa1gk8\r\nJUJUxbQboH09TFt3yIG2h4Sa+4JDTEAlARJ6VWyrZKqsS3VxNb/QM27uF0PpL6Pp\r\nbB1mIi411hBSNHcJMr4dZQKBgD2PqV3i/SF1E/J7d53vR5HwrumxE+Ol0SZiurBc\r\n7h7yeqP4KH7L1pKvXEc4WnONlTJxKnGVBsjtbmpFBZhbkfSjV/znJ3NwTrvr8EqR\r\n0KwGuaO9INYrLxj5quu84If/vmaCAH+hjd75aDobbrnWSTTWHyXS7Z3SOSwe7VzH\r\nPpgBAoGAJbGOBQHrnFBJ79n4Q6YDzZw8LmUOxffNSO5R9N94pwLsYYe3my63VCiJ\r\n1ZTusaiH0L8En3E8PAXHGkAb1JwjjJ89cJI7y5VC5Kh6O94J2J/bbURFtOZleQc2\r\nQgCch29UPYEv39RCMgkIao+lrmyPSqZUYK5Fy2Cd9M/SBOkc/fI=\r\n-----END RSA PRIVATE KEY-----\r\n'

    // Proceed with setting up the reverse proxy after successful connection
    setupReverseProxy({ key, cert, hostname, port, option })
  })

  socket.on('error', (err) => {
    log.error(`Failed to connect to ${option.from}: ${err.message}`)
    throw new Error(`Cannot start reverse proxy because ${option.from} is unreachable.`)
  })
}

export function setupReverseProxy({ key, cert, hostname, port, option }: { key?: string, cert?: string, hostname: string, port: number, option: Option }): void {
  log.debug('setupReverseProxy', { key, cert, hostname, port, option })

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
