import type { MultiReverseProxyConfig, ReverseProxyConfigs, ReverseProxyOption, ReverseProxyOptions, SingleReverseProxyConfig } from './types'
import * as fs from 'node:fs/promises'

export function debugLog(category: string, message: string, verbose?: boolean): void {
  if (verbose) {
    // eslint-disable-next-line no-console
    console.debug(`[rpx:${category}] ${message}`)
  }
}

/**
 * Extracts hostnames from proxy configuration
 */
export function extractHostname(options: ReverseProxyOption | ReverseProxyOptions): string[] {
  if (isMultiProxyOptions(options)) {
    return options.proxies.map((proxy) => {
      const domain = proxy.to || 'stacks.localhost'
      return domain.startsWith('http') ? new URL(domain).hostname : domain
    })
  }

  if (isSingleProxyOptions(options)) {
    const domain = options.to || 'stacks.localhost'
    return [domain.startsWith('http') ? new URL(domain).hostname : domain]
  }

  return ['stacks.localhost']
}

interface RootCA {
  certificate: string
  privateKey: string
}

export function isValidRootCA(value: unknown): value is RootCA {
  return (
    typeof value === 'object'
    && value !== null
    && 'certificate' in value
    && 'privateKey' in value
    && typeof (value as RootCA).certificate === 'string'
    && typeof (value as RootCA).privateKey === 'string'
  )
}

export function getPrimaryDomain(options?: ReverseProxyOption | ReverseProxyOptions): string {
  if (!options)
    return 'stacks.localhost'

  if (isMultiProxyOptions(options) && options.proxies.length > 0)
    return options.proxies[0].to || 'stacks.localhost'

  if (isSingleProxyOptions(options))
    return options.to || 'stacks.localhost'

  return 'stacks.localhost'
}

/**
 * Type guard for multi-proxy configuration
 */
export function isMultiProxyConfig(options: ReverseProxyConfigs): options is MultiReverseProxyConfig {
  return 'proxies' in options && Array.isArray(options.proxies)
}

/**
 * Type guard to check if options are for multi-proxy configuration
 */
export function isMultiProxyOptions(options: ReverseProxyOption | ReverseProxyOptions): options is MultiReverseProxyConfig {
  return 'proxies' in options && Array.isArray((options as MultiReverseProxyConfig).proxies)
}

/**
 * Type guard to check if options are for single-proxy configuration
 */
export function isSingleProxyOptions(options: ReverseProxyOption | ReverseProxyOptions): options is SingleReverseProxyConfig {
  return 'to' in options && typeof (options as SingleReverseProxyConfig).to === 'string'
}

/**
 * Safely delete a file if it exists
 */
export async function safeDeleteFile(filePath: string, verbose?: boolean): Promise<void> {
  try {
    // Try to delete the file directly without checking existence first
    await fs.unlink(filePath)
    debugLog('certificates', `Successfully deleted: ${filePath}`, verbose)
  }
  catch (err) {
    // Ignore errors where file doesn't exist
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      debugLog('certificates', `Warning: Could not delete ${filePath}: ${err}`, verbose)
    }
  }
}
