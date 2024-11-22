import type { ReverseProxyConfigs } from './types'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from 'bun-config'

// eslint-disable-next-line antfu/no-top-level-await
export const config: ReverseProxyConfigs = await loadConfig({
  name: 'reverse-proxy',
  defaultConfig: {
    from: 'localhost:5173',
    to: 'stacks.localhost',
    https: {
      caCertPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.ca.crt`),
      certPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt`),
      keyPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt.key`),
    },
    etcHostsCleanup: true,
    verbose: true,
  },
})
