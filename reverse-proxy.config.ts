import type { ReverseProxyOptions } from './src/types'
import os from 'node:os'
import path from 'node:path'

const config: ReverseProxyOptions = {
  from: 'localhost:5173',
  to: 'stacks.localhost',
  keyPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt.key`),
  certPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt`),
  caCertPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.ca.crt`),
  httpsRedirect: false,
  verbose: false,
}

export default config
