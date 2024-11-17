import type { TlsConfig } from '@stacksjs/tlsx'
import os from 'node:os'
import path from 'node:path'
import { log } from '@stacksjs/cli'
import { addCertToSystemTrustStoreAndSaveCert, createRootCA, generateCert } from '@stacksjs/tlsx'
import { config } from './config'

export function httpsConfig(): TlsConfig {
  const domain = config.to || 'stacks.localhost'
  const defaultConfig: TlsConfig = {
    domain,
    hostCertCN: domain,
    caCertPath: path.join(os.homedir(), '.stacks', 'ssl', `${domain}.ca.crt`),
    certPath: path.join(os.homedir(), '.stacks', 'ssl', `${domain}.crt`),
    keyPath: path.join(os.homedir(), '.stacks', 'ssl', `${domain}.crt.key`),
    altNameIPs: ['127.0.0.1'],
    altNameURIs: ['localhost'],
    organizationName: 'stacksjs.org',
    countryName: 'US',
    stateName: 'California',
    localityName: 'Playa Vista',
    commonName: domain,
    validityDays: 180,
    verbose: false,
  }

  if (config.https === true)
    return defaultConfig

  return {
    ...defaultConfig,
    ...config.https,
  }
}

export async function generateCertificate(domain?: string): Promise<void> {
  if (config.https === true)
    config.https = httpsConfig()
  else if (config.https === false)
    return

  domain = domain ?? config.https.domain

  log.info(`Generating a self-signed SSL certificate for: ${domain}`)

  const caCert = await createRootCA(config.https)
  const hostCert = await generateCert({
    hostCertCN: config.https.commonName ?? domain,
    domain,
    altNameIPs: config.https.altNameIPs,
    altNameURIs: config.https.altNameURIs,
    countryName: config.https.countryName,
    stateName: config.https.stateName,
    localityName: config.https.localityName,
    organizationName: config.https.organizationName,
    validityDays: config.https.validityDays,
    rootCAObject: {
      certificate: caCert.certificate,
      privateKey: caCert.privateKey,
    },
    verbose: config.https.verbose || config.verbose,
  })

  await addCertToSystemTrustStoreAndSaveCert(hostCert, caCert.certificate, config.https)

  log.success('Certificate generated')
}
