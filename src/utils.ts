import { config } from './config'

export function debugLog(category: string, message: string, verbose?: boolean): void {
  if (verbose || config.verbose) {
    // eslint-disable-next-line no-console
    console.debug(`[rpx:${category}] ${message}`)
  }
}
