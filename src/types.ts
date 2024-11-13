export interface ReverseProxyConfig {
  from: string // domain to proxy from, defaults to localhost:3000
  to: string // domain to proxy to, defaults to stacks.localhost
  key?: string // content of the key
  keyPath?: string // absolute path to the key
  cert?: string // content of the cert
  certPath?: string // absolute path to the cert
  caCertPath?: string // absolute path to the ca cert
  httpsRedirect: boolean // redirect http to https, defaults to true
  verbose: boolean
}

export type ReverseProxyOption = Partial<ReverseProxyConfig>
export type ReverseProxyOptions = ReverseProxyOption | ReverseProxyOption[]
