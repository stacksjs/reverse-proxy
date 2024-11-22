import type { TlsConfig } from '@stacksjs/tlsx'

export type CustomTlsConfig = Partial<Omit<TlsConfig, 'caCertPath' | 'certPath' | 'keyPath'>> &
  Pick<TlsConfig, 'caCertPath' | 'certPath' | 'keyPath'>

export interface BaseReverseProxyConfig {
  from: string // localhost:5173
  to: string // stacks.localhost
}

export interface SharedProxySettings {
  https: boolean | CustomTlsConfig
  etcHostsCleanup: boolean
  verbose: boolean
  _cachedSSLConfig?: SSLConfig | null
}

export interface SingleReverseProxyConfig extends BaseReverseProxyConfig, SharedProxySettings {}

export interface MultiReverseProxyConfig extends SharedProxySettings {
  proxies: BaseReverseProxyConfig[]
}

export type ReverseProxyConfigs = SingleReverseProxyConfig | MultiReverseProxyConfig

export type BaseReverseProxyOption = Partial<BaseReverseProxyConfig>
export type PartialSharedSettings = Partial<SharedProxySettings>

export type MultiReverseProxyOption = MultiReverseProxyConfig

export type ReverseProxyOption = SingleReverseProxyConfig
export type ReverseProxyOptions = SingleReverseProxyConfig | MultiReverseProxyOption

export interface SSLConfig {
  key: string
  cert: string
  ca?: string | string[]
}

export interface ProxySetupOptions extends Omit<ReverseProxyOption, 'from'> {
  fromPort: number
  sourceUrl: Pick<URL, 'hostname' | 'host'>
  ssl: SSLConfig | null
  from: string
  to: string
}

export interface PortManager {
  usedPorts: Set<number>
  getNextAvailablePort: (startPort: number) => Promise<number>
}

export interface ProxySetupOptions extends Omit<ReverseProxyOption, 'from'> {
  fromPort: number
  sourceUrl: Pick<URL, 'hostname' | 'host'>
  ssl: SSLConfig | null
  from: string
  to: string
  portManager?: PortManager
}

export type { TlsConfig }
