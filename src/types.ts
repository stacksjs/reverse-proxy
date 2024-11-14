import type { DeepPartial, TlsConfig } from '@stacksjs/tlsx'

export interface ReverseProxyConfig {
  from: string // domain to proxy from, defaults to localhost:3000
  to: string // domain to proxy to, defaults to stacks.localhost
  key?: string // content of the key
  keyPath?: string // absolute path to the key
  cert?: string // content of the cert
  certPath?: string // absolute path to the cert
  caCertPath?: string // absolute path to the ca cert
  https: boolean // use https, defaults to true
  tls: boolean | TlsConfig // the tls configuration
  verbose: boolean
}

export type ReverseProxyOption = DeepPartial<ReverseProxyConfig>
export type ReverseProxyOptions = ReverseProxyOption | ReverseProxyOption[]

export interface SSLConfig {
  key: string
  cert: string
  ca?: string | string[]
  secureOptions?: number
}

export interface ProxySetupOptions extends Omit<ReverseProxyOption, 'from'> {
  fromPort: number
  sourceUrl: Pick<URL, 'hostname' | 'host'>
  ssl: SSLConfig | null
  from: string
  to: string
}
