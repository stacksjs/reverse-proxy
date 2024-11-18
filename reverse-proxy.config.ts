import type { ReverseProxyOptions } from './src/types'

const config: ReverseProxyOptions = [
  {
    from: 'localhost:5173',
    to: 'test.localhost',
    https: true,
    // https: {
    //   domain: 'stacks.localhost',
    //   hostCertCN: 'stacks.localhost',
    //   caCertPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.ca.crt`),
    //   certPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt`),
    //   keyPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt.key`),
    //   altNameIPs: ['127.0.0.1'],
    //   altNameURIs: ['localhost'],
    //   organizationName: 'stacksjs.org',
    //   countryName: 'US',
    //   stateName: 'California',
    //   localityName: 'Playa Vista',
    //   commonName: 'stacks.localhost',
    //   validityDays: 180,
    //   verbose: false,
    // },
    verbose: true,
  },
  {
    from: 'localhost:5174',
    to: 'test.local',
    https: true,
    etcHostsCleanup: true,
    verbose: true,
  },
]

// const config = {
//   from: 'localhost:5173',
//   to: 'test2.localhost',
//   https: true,
//   verbose: true,
// }

export default config
