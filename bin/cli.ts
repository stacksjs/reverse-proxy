import { CAC } from 'cac'
import { version } from '../package.json'
import { config } from '../src/config'
import { httpsConfig } from '../src/https'
import { startProxies, startProxy } from '../src/start'

const cli = new CAC('reverse-proxy')

interface ReverseProxyOption {
  from: string
  to: string
  keyPath: string
  certPath: string
  caCertPath: string
  cleanup: {
    certs: boolean
    hosts: boolean
  }
  verbose: boolean
}

cli
  .command('start', 'Start the Reverse Proxy Server')
  .option('--from <from>', 'The URL to proxy from')
  .option('--to <to>', 'The URL to proxy to')
  .option('--key-path <path>', 'Absolute path to the SSL key')
  .option('--cert-path <path>', 'Absolute path to the SSL certificate')
  .option('--ca-cert-path <path>', 'Absolute path to the SSL CA certificate')
  .option('--hosts-cleanup', 'Cleanup /etc/hosts on exit')
  .option('--certs-cleanup', 'Cleanup SSL certificates on exit')
  .option('--verbose', 'Enable verbose logging')
  .example('reverse-proxy start --from localhost:5173 --to my-project.localhost')
  .example('reverse-proxy start --from localhost:3000 --to my-project.localhost/api')
  .example('reverse-proxy start --from localhost:3000 --to localhost:3001')
  .example('reverse-proxy start --from localhost:5173 --to my-project.test --key-path /absolute/path/to/key --cert-path /absolute/path/to/cert')
  .action(async (options?: ReverseProxyOption) => {
    if (!options?.from || !options.to) {
      return startProxies(config)
    }

    return startProxy({
      from: options?.from,
      to: options?.to,
      https: httpsConfig(options),
      cleanup: {
        certs: options?.cleanup.certs,
        hosts: options?.cleanup.hosts,
      },
      verbose: options?.verbose,
    })
  })

cli.command('version', 'Show the version of the Reverse Proxy CLI').action(() => {
  console.log(version)
})

cli.version(version)
cli.help()
cli.parse()
