import { homedir } from 'node:os'
import { join } from 'node:path'
import { config } from './config'

export function keyPath(): string {
  if (typeof config.https === 'boolean')
    return join(homedir(), '.stacks', 'ssl', `stacks.localhost.key`)

  return config.https.keyPath
}

export function certPath(): string {
  if (typeof config.https === 'boolean')
    return join(homedir(), '.stacks', 'ssl', `stacks.localhost.crt`)

  return config.https.certPath
}

export function caCertPath(): string {
  if (typeof config.https === 'boolean')
    return join(homedir(), '.stacks', 'ssl', `stacks.localhost.ca.crt`)

  return config.https.caCertPath
}

export function debugLog(category: string, message: string, verbose?: boolean): void {
  if (verbose || config.verbose) {
    // eslint-disable-next-line no-console
    console.debug(`[rpx:${category}] ${message}`)
  }
}
