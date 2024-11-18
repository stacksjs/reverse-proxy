import type { ReverseProxyOption, ReverseProxyOptions, TlsConfig } from './types'
import os from 'node:os'
import path from 'node:path'
import { log } from '@stacksjs/cli'
import { addCertToSystemTrustStoreAndSaveCert, createRootCA, generateCertificate as generateCert } from '@stacksjs/tlsx'
import { debugLog } from './utils'

let cachedSSLConfig: { key: string, cert: string, ca?: string } | null = null

function extractDomains(options: ReverseProxyOptions): string[] {
  if (Array.isArray(options)) {
    return options.map((opt) => {
      const domain = opt.to || 'stacks.localhost'
      return domain.startsWith('http') ? new URL(domain).hostname : domain
    })
  }
  const domain = options.to || 'stacks.localhost'
  return [domain.startsWith('http') ? new URL(domain).hostname : domain]
}

// Generate wildcard patterns for a domain
function generateWildcardPatterns(domain: string): string[] {
  const patterns = new Set<string>()
  patterns.add(domain) // Add exact domain

  // Split domain into parts (e.g., "test.local" -> ["test", "local"])
  const parts = domain.split('.')
  if (parts.length >= 2) {
    // Add wildcard for the domain (e.g., "*.local" for "test.local")
    patterns.add(`*.${parts.slice(1).join('.')}`)
  }

  return Array.from(patterns)
}

function generateBaseConfig(domains: string[], verbose?: boolean): TlsConfig {
  const sslBase = path.join(os.homedir(), '.stacks', 'ssl')

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
  const config: TlsConfig = {
    domain: domains[0],
    hostCertCN: domains[0],
    caCertPath: path.join(sslBase, 'rpx-root-ca.crt'),
    certPath: path.join(sslBase, 'rpx-certificate.crt'),
    keyPath: path.join(sslBase, 'rpx-certificate.key'),
    altNameIPs: ['127.0.0.1', '::1'],
    // altNameURIs needs to be an empty array as we're using DNS names instead
    altNameURIs: [],
    // The real domains go in the commonName and subject alternative names
    commonName: domains[0],
    organizationName: 'RPX Local Development',
    countryName: 'US',
    stateName: 'California',
    localityName: 'Playa Vista',
    validityDays: 825,
    verbose: verbose ?? false,
    // Add Subject Alternative Names as DNS names
    subjectAltNames: uniqueDomains.map(domain => ({
      type: 2, // DNS type
      value: domain,
    })),
  }

  return config
}

function generateRootCAConfig(): TlsConfig {
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
    verbose: true,
  }
}

export function httpsConfig(options: ReverseProxyOption | ReverseProxyOptions): TlsConfig {
  const domains = extractDomains(options)
  const verbose = Array.isArray(options) ? options[0]?.verbose : options.verbose

  return generateBaseConfig(domains, verbose)
}

export async function generateCertificate(options: ReverseProxyOption | ReverseProxyOptions): Promise<void> {
  if (cachedSSLConfig) {
    debugLog('ssl', 'Using cached SSL configuration', Array.isArray(options) ? options[0]?.verbose : options.verbose)
    return
  }

  const domains = extractDomains(options)
  const verbose = Array.isArray(options) ? options[0]?.verbose : options.verbose

  debugLog('ssl', `Generating certificate for domains: ${domains.join(', ')}`, verbose)

  // Generate Root CA first
  const rootCAConfig = generateRootCAConfig()
  log.info('Generating Root CA certificate...')
  const caCert = await createRootCA(rootCAConfig)

  // Generate the host certificate with all domains
  const hostConfig = generateBaseConfig(domains, verbose)
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
