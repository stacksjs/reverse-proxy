import type { ReverseProxyConfig } from './types'
import { loadConfig } from 'bun-config'

// Get loaded config
// eslint-disable-next-line antfu/no-top-level-await
const config: ReverseProxyConfig = await loadConfig({
  name: 'reverse-proxy',
  defaultConfig: {
    'localhost:5173': 'stacks.localhost',
  },
})

export { config }
