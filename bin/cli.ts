import os from 'node:os'
import { CAC } from 'cac'
import { readFileSync, writeFileSync } from 'fs-extra'
import { log } from '@stacksjs/logging'
import { startProxy } from '../src/start'
import { config } from '../src/config'
import { version } from '../package.json'

const cli = new CAC('reverse-proxy')

interface Options {
  from?: string
  to?: string
  keyPath?: string
  certPath?: string
  verbose?: boolean
}

cli
  .command('start', 'Start the Reverse Proxy Server')
  .option('--from <from>', 'The URL to proxy from')
  .option('--to <to>', 'The URL to proxy to')
  .option('--keyPath <path>', 'Absolute path to the SSL key')
  .option('--certPath <path>', 'Absolute path to the SSL certificate')
  .option('--verbose', 'Enable verbose logging', { default: false })
  .example('reverse-proxy start --from localhost:3000 --to my-project.localhost')
  .example('reverse-proxy start --from localhost:3000 --to localhost:3001')
  .example('reverse-proxy start --from localhost:3000 --to my-project.test --keyPath /absolute/path/to/key --certPath /absolute/path/to/cert')
  .action(async (options?: Options) => {
    if (options?.from || options?.to) {
      startProxy({
        from: options?.from ?? 'localhost:3000',
        to: options?.to ?? 'stacks.localhost',
        keyPath: options?.keyPath,
        certPath: options?.certPath,
      })

      return
    }

    // loop over the config and start all the proxies
    if (config) {
      for (const [from, to] of Object.entries(config)) {
        startProxy({
          from,
          to,
          keyPath: options?.keyPath,
          certPath: options?.certPath,
        })
      }
    }
    else {
      // eslint-disable-next-line no-console
      console.log('No proxies found in the config')
    }
  })

cli
  .command('update:etc-hosts', 'Update the /etc/hosts file with the proxy domains. Please note, this command requires sudo/admin permissions.')
  .alias('update-etc-hosts')
  .example('sudo reverse-proxy update:etc-hosts')
  .example('sudo reverse-proxy update-etc-hosts')
  .action(async () => {
    log.info('Ensuring /etc/hosts file covers the proxy domain/s...')

    const hostsFilePath = os.platform() === 'win32'
      ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
      : '/etc/hosts'

    if (config && typeof config === 'object') {
      const entriesToAdd = Object.entries(config).map(([from, to]) => `127.0.0.1 ${to} # reverse-proxy mapping for ${from}`)
      // Ensure "127.0.0.1 localhost" is in the array
      entriesToAdd.push('127.0.0.1 localhost # essential localhost mapping')

      try {
        let currentHostsContent = readFileSync(hostsFilePath, 'utf8')
        let updated = false

        for (const entry of entriesToAdd) {
          const [ip, host] = entry.split(' ', 2)
          // Use a regex to match the line with any amount of whitespace between IP and host
          const regex = new RegExp(`^${ip}\\s+${host.split(' ')[0]}(\\s|$)`, 'm')
          // Check if the entry (domain) is already in the file
          if (!regex.test(currentHostsContent)) {
            // If not, append it
            currentHostsContent += `\n${entry}`
            updated = true
          }
          else {
            log.info(`Entry for ${host} already exists in the hosts file.`)
          }
        }

        if (updated) {
          writeFileSync(hostsFilePath, currentHostsContent, 'utf8')
          log.success('Hosts file updated with latest proxy domains.')
        }
        else {
          log.info('No new entries were added to the hosts file.')
        }
      }
      catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'EACCES')
          console.error('Permission denied. Please run this command with administrative privileges.')
        else
          console.error(`An error occurred: ${(error as NodeJS.ErrnoException).message}`)
      }
    }
    else {
      // eslint-disable-next-line no-console
      console.log('No proxies found. Is your config configured properly?')
    }
  })

cli
  .command('version', 'Show the version of the Reverse Proxy CLI')
  .action(() => {
    // eslint-disable-next-line no-console
    console.log(version)
  })

cli.version(version)
cli.help()
cli.parse()
