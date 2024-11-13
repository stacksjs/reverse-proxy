import type { ReverseProxyOptions } from './src/types'
import os from 'node:os'
import path from 'node:path'

const config: ReverseProxyOptions = {
  from: 'localhost:5173',
  to: 'stacks.localhost',
  // key: 'content of the key',
  // keyPath: '/absolute/path/to/the/key',
  keyPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt.key`),
  // cert: 'content of the cert',
  // certPath: '/absolute/path/to/the/cert',
  certPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt`),
  caCertPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.ca.crt`),
  httpsRedirect: false,
  verbose: false,
}

export default config
