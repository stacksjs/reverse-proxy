import type { CustomTlsConfig, MultiReverseProxyConfig, ReverseProxyConfig, ReverseProxyConfigs, ReverseProxyOption, SSLConfig, TlsConfig } from './types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { log } from '@stacksjs/cli'
import { addCertToSystemTrustStoreAndSaveCert, createRootCA, generateCertificate as generateCert } from '@stacksjs/tlsx'
import { config } from './config'
import { debugLog, extractDomains, getDomainFromOptions } from './utils'

let cachedSSLConfig: { key: string, cert: string, ca?: string } | null = null

export function isMultiProxyConfig(options: ReverseProxyConfigs): options is MultiReverseProxyConfig {
  return 'proxies' in options
}

// Generate wildcard patterns for a domain
function generateWildcardPatterns(domain: string): string[] {
  const patterns = new Set<string>()
  patterns.add(domain)

  // Split domain into parts (e.g., "test.local" -> ["test", "local"])
  const parts = domain.split('.')
  if (parts.length >= 2) {
    // Add wildcard for the domain (e.g., "*.local" for "test.local")
    patterns.add(`*.${parts.slice(1).join('.')}`)
  }

  return Array.from(patterns)
}

function generateBaseConfig(options: ReverseProxyConfigs, verbose?: boolean): TlsConfig {
  const domains = extractDomains(options)
  const sslBase = path.join(os.homedir(), '.stacks', 'ssl')
  const httpsConfig: Partial<CustomTlsConfig> = options.https === true
    ? {
        caCertPath: path.join(sslBase, 'rpx-ca.crt'),
        certPath: path.join(sslBase, 'rpx.crt'),
        keyPath: path.join(sslBase, 'rpx.key'),
      }
    : typeof config.https === 'object'
      ? {
          ...options.https,
          ...config.https,
        }
      : {}

  debugLog('ssl', `Extracted domains: ${domains.join(', ')}`, verbose)
  debugLog('ssl', `Using SSL base path: ${sslBase}`, verbose)
  debugLog('ssl', `Using HTTPS config: ${JSON.stringify(httpsConfig)}`, verbose)
  // Generate all possible SANs, including wildcards
  const allPatterns = new Set<string>()
  domains.forEach((domain) => {
    // Add direct domain
    allPatterns.add(domain)

    // Add wildcard patterns
    generateWildcardPatterns(domain).forEach(pattern => allPatterns.add(pattern))
  })

  // Add localhost patterns
  allPatterns.add('localhost')
  allPatterns.add('*.localhost')

  const uniqueDomains = Array.from(allPatterns)
  debugLog('ssl', `Generated domain patterns: ${uniqueDomains.join(', ')}`, verbose)

  // Create a single object that contains all the config
  return {
    // Use the first domain for the certificate CN
    domain: domains[0],
    hostCertCN: domains[0],
    caCertPath: httpsConfig?.caCertPath ?? path.join(sslBase, 'rpx-ca.crt'),
    certPath: httpsConfig?.certPath ?? path.join(sslBase, 'rpx.crt'),
    keyPath: httpsConfig?.keyPath ?? path.join(sslBase, 'rpx.key'),
    altNameIPs: httpsConfig?.altNameIPs ?? ['127.0.0.1', '::1'],
    altNameURIs: httpsConfig?.altNameURIs ?? [],
    // Include all domains in the SAN
    commonName: httpsConfig?.commonName ?? domains[0],
    organizationName: httpsConfig?.organizationName ?? 'Local Development',
    countryName: httpsConfig?.countryName ?? 'US',
    stateName: httpsConfig?.stateName ?? 'California',
    localityName: httpsConfig?.localityName ?? 'Playa Vista',
    validityDays: httpsConfig?.validityDays ?? 825,
    verbose: verbose ?? false,
    // Add all domains as Subject Alternative Names
    subjectAltNames: uniqueDomains.map(domain => ({
      type: 2, // DNS type
      value: domain,
    })),
  } satisfies TlsConfig
}

function generateRootCAConfig(verbose: boolean = false): TlsConfig {
  const sslBase = path.join(os.homedir(), '.stacks', 'ssl')

  return {
    domain: 'stacks.localhost',
    hostCertCN: 'stacks.localhost',
    caCertPath: path.join(sslBase, 'rpx-root-ca.crt'),
    certPath: path.join(sslBase, 'rpx-certificate.crt'),
    keyPath: path.join(sslBase, 'rpx-certificate.key'),
    altNameIPs: ['127.0.0.1', '::1'],
    altNameURIs: [],
    organizationName: 'Stacks Local Development',
    countryName: 'US',
    stateName: 'California',
    localityName: 'Playa Vista',
    commonName: 'stacks.localhost',
    validityDays: 3650,
    verbose,
  }
}

export function httpsConfig(options: ReverseProxyConfig): CustomTlsConfig {
  const domain = getDomainFromOptions(options)

  // Log the domain and paths being used
  debugLog('ssl', `Using domain ${domain} for SSL config`, options.verbose)

  const sslConfig = {
    caCertPath: `${config.sslPath}/${domain}.ca.crt`,
    certPath: `${config.sslPath}/${domain}.crt`,
    keyPath: `${config.sslPath}/${domain}.crt.key`,
  }

  debugLog('ssl', `SSL config paths: ${JSON.stringify(sslConfig)}`, options.verbose)
  return sslConfig
}

/**
 * Load SSL certificates from files or use provided strings
 */
export async function loadSSLConfig(options: ReverseProxyOption): Promise<SSLConfig | null> {
  debugLog('ssl', `Loading SSL configuration`, options.verbose)

  const mergedOptions = {
    ...config,
    ...options,
  }

  if (options.https === true)
    options.https = httpsConfig(mergedOptions)
  else if (options.https === false)
    return null

  // Early return for non-SSL configuration
  if (!options.https?.keyPath && !options.https?.certPath) {
    debugLog('ssl', 'No SSL configuration provided', options.verbose)
    return null
  }

  if ((options.https?.keyPath && !options.https?.certPath) || (!options.https?.keyPath && options.https?.certPath)) {
    const missing = !options.https?.keyPath ? 'keyPath' : 'certPath'
    debugLog('ssl', `Invalid SSL configuration - missing ${missing}`, options.verbose)
    throw new Error(`SSL Configuration requires both keyPath and certPath. Missing: ${missing}`)
  }

  try {
    if (!options.https?.keyPath || !options.https?.certPath)
      return null

    // Try to read existing certificates
    try {
      debugLog('ssl', 'Reading SSL certificate files', options.verbose)
      const key = await fs.readFile(options.https?.keyPath, 'utf8')
      const cert = await fs.readFile(options.https?.certPath, 'utf8')

      debugLog('ssl', 'SSL configuration loaded successfully', options.verbose)
      return { key, cert }
    }
    catch (error) {
      debugLog('ssl', `Failed to read certificates: ${error}`, options.verbose)
      return null
    }
  }
  catch (err) {
    debugLog('ssl', `SSL configuration error: ${err}`, options.verbose)
    throw err
  }
}

export async function generateCertificate(options: ReverseProxyConfigs): Promise<void> {
  if (cachedSSLConfig) {
    const verbose = isMultiProxyConfig(options) ? options.verbose : options.verbose
    debugLog('ssl', 'Using cached SSL configuration', verbose)
    return
  }

  // Get all unique domains from the configuration
  const domains = isMultiProxyConfig(options)
    ? [options.proxies[0].to, ...options.proxies.map(proxy => proxy.to)] // Include the first domain from proxies array
    : [options.to]

  const verbose = isMultiProxyConfig(options) ? options.verbose : options.verbose

  debugLog('ssl', `Generating certificate for domains: ${domains.join(', ')}`, verbose)

  // Generate Root CA first
  const rootCAConfig = generateRootCAConfig(verbose)
  log.info('Generating Root CA certificate...')
  const caCert = await createRootCA(rootCAConfig)

  // Generate the host certificate with all domains
  const hostConfig = generateBaseConfig(options, verbose)
  log.info(`Generating host certificate for: ${domains.join(', ')}`)

  const hostCert = await generateCert({
    ...hostConfig,
    rootCAObject: {
      certificate: caCert.certificate,
      privateKey: caCert.privateKey,
    },
  })

  // Add to system trust store with all necessary options
  await addCertToSystemTrustStoreAndSaveCert(hostCert, caCert.certificate, hostConfig)

  // Cache the SSL config for reuse
  cachedSSLConfig = {
    key: hostCert.privateKey,
    cert: hostCert.certificate,
    ca: caCert.certificate,
  }

  log.success(`Certificate generated successfully for ${domains.length} domain${domains.length > 1 ? 's' : ''}`)
  debugLog('ssl', `Certificate includes domains: ${domains.join(', ')}`, verbose)
}

export function getSSLConfig(): { key: string, cert: string, ca?: string } | null {
  return cachedSSLConfig
}

export async function checkExistingCertificates(options: ReverseProxyConfigs): Promise<SSLConfig | null> {
  // Skip if HTTPS is not enabled
  if (!options.https)
    return null

  const mergedOptions = {
    ...config,
    ...options,
  }

  // Convert boolean https to TLS config if needed
  const tlsConfig = httpsConfig(mergedOptions)

  try {
    // Read the existing certificates
    const key = await fs.readFile(tlsConfig.keyPath, 'utf8')
    const cert = await fs.readFile(tlsConfig.certPath, 'utf8')
    let ca: string | undefined

    if (tlsConfig.caCertPath) {
      try {
        ca = await fs.readFile(tlsConfig.caCertPath, 'utf8')
      }
      catch (err) {
        debugLog('ssl', `Failed to read CA cert: ${err}`, options.verbose)
      }
    }

    // If we successfully read the certificates, return them
    return { key, cert, ca }
  }
  catch (err) {
    debugLog('ssl', `Failed to read certificates: ${err}`, options.verbose)
    return null
  }
}
