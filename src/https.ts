import { log } from '@stacksjs/cli'
import { addCertToSystemTrustStoreAndSaveCert, createRootCA, generateCert } from '@stacksjs/tlsx'
import { config } from './config'

export async function generateCertificate(domain?: string): Promise<void> {
  domain = domain ?? config.https.altNameURIs[0]

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
