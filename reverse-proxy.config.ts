import type { ReverseProxyOptions } from './src/types'
import os from 'node:os'
import path from 'node:path'

const config: ReverseProxyOptions = {
  from: 'localhost:5173',
  to: 'stacks.localhost',
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
  verbose: false,
}

export default config
