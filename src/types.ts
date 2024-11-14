import type { TlsConfig } from '@stacksjs/tlsx'

export interface ReverseProxyConfig {
  from: string // localhost:5173
  to: string // stacks.localhost
  https: TlsConfig
  verbose: boolean
}

export type ReverseProxyOption = Partial<ReverseProxyConfig>
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

export type { TlsConfig }
