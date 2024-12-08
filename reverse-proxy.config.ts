import type { ReverseProxyOptions } from './src/types'

const config: ReverseProxyOptions = {
  // https: {
  //   caCertPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.ca.crt`),
  //   certPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt`),
  //   keyPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt.key`),
  // },
  https: true,
  etcHostsCleanup: true,
  proxies: [
    {
      from: 'localhost:5173',
      to: 'docs.localhost',
      cleanUrls: true,
    },
    // {
    //   from: 'localhost:5174',
    //   to: 'test.local',
    // },
  ],
  verbose: false,
}

// alternatively, you can use the following configuration
// const config = {
//   from: 'localhost:5173',
//   to: 'test2.localhost',
//   https: true,
//   verbose: true,
// }

export default config
