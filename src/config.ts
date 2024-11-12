import type { ReverseProxyConfig } from './types'
import { loadConfig } from 'bun-config'

// eslint-disable-next-line antfu/no-top-level-await
const config: ReverseProxyConfig = await loadConfig({
  name: 'reverse-proxy',
  defaultConfig: {
    from: 'localhost:5173',
    to: 'stacks.localhost',
    key: undefined,
    keyPath: undefined,
    cert: undefined,
    certPath: undefined,
    httpsRedirect: false,
    verbose: true,
  },
})

export { config }
