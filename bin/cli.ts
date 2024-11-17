import { CAC } from '@stacksjs/cli'
import { version } from '../package.json'
import { config } from '../src/config'
import { httpsConfig } from '../src/https'
import { startProxy } from '../src/start'
import { caCertPath, certPath, keyPath } from '../src/utils'

const cli = new CAC('reverse-proxy')

interface ReverseProxyOption {
  from: string
  to: string
  keyPath: string
  certPath: string
  caCertPath: string
  etcHostsCleanup: boolean
  verbose: boolean
}

cli
  .command('start', 'Start the Reverse Proxy Server')
  .option('--from <from>', 'The URL to proxy from', { default: config.from })
  .option('--to <to>', 'The URL to proxy to', { default: config.to })
  .option('--key-path <path>', 'Absolute path to the SSL key', { default: keyPath() })
  .option('--cert-path <path>', 'Absolute path to the SSL certificate', { default: certPath() })
  .option('--ca-cert-path <path>', 'Absolute path to the SSL CA certificate', { default: caCertPath() })
  .option('--etc-hosts-cleanup', 'Cleanup /etc/hosts on exit', { default: config.etcHostsCleanup })
  .option('--verbose', 'Enable verbose logging', { default: config.verbose })
  .example('reverse-proxy start --from localhost:5173 --to my-project.localhost')
  .example('reverse-proxy start --from localhost:3000 --to my-project.localhost/api')
  .example('reverse-proxy start --from localhost:3000 --to localhost:3001')
  .example('reverse-proxy start --from localhost:5173 --to my-project.test --key-path /absolute/path/to/key --cert-path /absolute/path/to/cert')
  .action(async (options?: ReverseProxyOption) => {
    const https = {
      ...httpsConfig(),
      keyPath: options?.keyPath || keyPath(),
      certPath: options?.certPath || certPath(),
      caCertPath: options?.caCertPath || caCertPath(),
    }

    startProxy({
      from: options?.from,
      to: options?.to,
      https,
      etcHostsCleanup: options?.etcHostsCleanup,
      verbose: options?.verbose,
    })
  })

cli.command('version', 'Show the version of the Reverse Proxy CLI').action(() => {
  console.log(version)
})

cli.version(version)
cli.help()
cli.parse()
