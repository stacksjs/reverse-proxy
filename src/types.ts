import type { TlsConfig, TlsOption } from '@stacksjs/tlsx'

export interface BaseReverseProxyConfig {
  from: string // localhost:5173
  to: string // stacks.localhost
  cleanUrls: boolean // false
}
export type BaseReverseProxyOptions = Partial<BaseReverseProxyConfig>

export interface CleanupConfig {
  domains: string[] // default: [], if only specific domain/s should be cleaned up
  hosts: boolean // default: true, if hosts file should be cleaned up
  certs: boolean // default: false, if certificates should be cleaned up
  verbose: boolean // default: false
}

export type CleanupOptions = Partial<CleanupConfig>

export interface SharedProxyConfig {
  https: boolean | TlsOption
  cleanup: boolean | CleanupOptions
  vitePluginUsage: boolean
  verbose: boolean
  _cachedSSLConfig?: SSLConfig | null
}
export type SharedProxyOptions = Partial<SharedProxyConfig>

export interface SingleReverseProxyConfig extends BaseReverseProxyConfig, SharedProxyConfig {}
export interface MultiReverseProxyConfig extends SharedProxyConfig {
  proxies: BaseReverseProxyConfig[]
}
export type ReverseProxyConfig = SingleReverseProxyConfig
export type ReverseProxyConfigs = SingleReverseProxyConfig | MultiReverseProxyConfig

export type BaseReverseProxyOption = Partial<BaseReverseProxyConfig>
export type ReverseProxyOption = Partial<SingleReverseProxyConfig>
export type ReverseProxyOptions = Partial<SingleReverseProxyConfig> | Partial<MultiReverseProxyConfig>

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

export type { TlsConfig, TlsOption }
