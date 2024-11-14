import type { ReverseProxyOption } from '../src/types'
import { CAC } from '@stacksjs/cli'
import { version } from '../package.json'
import { config } from '../src/config'
import { startProxy } from '../src/start'

const cli = new CAC('reverse-proxy')

cli
  .command('start', 'Start the Reverse Proxy Server')
  .option('--from <from>', 'The URL to proxy from', { default: config.from })
  .option('--to <to>', 'The URL to proxy to', { default: config.to })
  .option('--key-path <path>', 'Absolute path to the SSL key', { default: config.keyPath })
  .option('--cert-path <path>', 'Absolute path to the SSL certificate', { default: config.certPath })
  .option('--verbose', 'Enable verbose logging', { default: config.verbose })
  .example('reverse-proxy start --from localhost:5173 --to my-project.localhost')
  .example('reverse-proxy start --from localhost:3000 --to my-project.localhost/api')
  .example('reverse-proxy start --from localhost:3000 --to localhost:3001')
  .example('reverse-proxy start --from localhost:5173 --to my-project.test --key-path /absolute/path/to/key --cert-path /absolute/path/to/cert')
  .action(async (options?: ReverseProxyOption) => {
    startProxy({
      from: options?.from,
      to: options?.to,
      keyPath: options?.keyPath,
      certPath: options?.certPath,
      verbose: options?.verbose,
    })
  })

cli.command('version', 'Show the version of the Reverse Proxy CLI').action(() => {
  console.log(version)
})

cli.version(version)
cli.help()
cli.parse()
