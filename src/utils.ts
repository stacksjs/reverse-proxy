import type { ReverseProxyConfigs } from './types'
import { isMultiProxyConfig } from './https'

export function debugLog(category: string, message: string, verbose?: boolean): void {
  if (verbose) {
    // eslint-disable-next-line no-console
    console.debug(`[rpx:${category}] ${message}`)
  }
}

export function extractDomains(options: ReverseProxyConfigs): string[] {
  if (isMultiProxyConfig(options)) {
    return options.proxies.map((proxy) => {
      const domain = proxy.to || 'stacks.localhost'
      return domain.startsWith('http') ? new URL(domain).hostname : domain
    })
  }

  const domain = options.to || 'stacks.localhost'
  return [domain.startsWith('http') ? new URL(domain).hostname : domain]
}

export function getDomainFromOptions(options: ReverseProxyConfigs): string {
  if (isMultiProxyConfig(options) && options.proxies.length > 0) {
    return options.proxies[0].to ?? 'stacks.localhost'
  }

  if ('to' in options) {
    return options.to ?? 'stacks.localhost'
  }

  return 'stacks.localhost'
}
