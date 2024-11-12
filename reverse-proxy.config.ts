import type { ReverseProxyOption } from './src/types'

const config: ReverseProxyOption = {
  from: 'localhost:5173',
  to: 'stacks.localhost',
  key: 'content of the key',
  // keyPath: '/absolute/path/to/the/key',
  cert: 'content of the cert',
  // certPath: '/absolute/path/to/the/cert',
  httpsRedirect: true,
  verbose: false,
}

export default config
