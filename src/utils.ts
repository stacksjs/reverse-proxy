import { config } from './config'

export function debugLog(category: string, message: string): void {
  if (config.verbose) {
    // eslint-disable-next-line no-console
    console.debug(`[rpx:${category}] ${message}`)
  }
}
