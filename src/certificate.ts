import type { TlsOption } from '@stacksjs/tlsx'
import * as fs from 'node:fs'
import { log } from '@stacksjs/cli'
import { addCertToSystemTrustStoreAndSaveCert, createRootCA, generateCert } from '@stacksjs/tlsx'
import { config } from './config'

export async function generateCertficate(options?: TlsOption): Promise<{ key: string, cert: string, ca: string }> {
  const conf = config?.tls
  const mergedOptions = {
    ...conf,
    ...(options || {}),
  }

  const domain = mergedOptions.domain || 'localhost'
  log.info(`Generating a self-signed SSL certificate for: ${domain}`)

  const caCert = await createRootCA()
  const hostCert = await generateCert({
    hostCertCN: mergedOptions?.commonName ?? mergedOptions.commonName ?? domain,
    domain,
    altNameIPs: mergedOptions?.altNameIPs?.filter((ip): ip is string => ip !== undefined) ?? [],
    altNameURIs: mergedOptions?.altNameURIs?.filter((uri): uri is string => uri !== undefined) ?? [],
    countryName: mergedOptions.countryName,
    stateName: mergedOptions.stateName,
    localityName: mergedOptions.localityName,
    organizationName: mergedOptions.organizationName,
    validityDays: mergedOptions.validityDays,
    rootCAObject: {
      certificate: caCert.certificate,
      privateKey: caCert.privateKey,
    },
  })

  await addCertToSystemTrustStoreAndSaveCert(hostCert, caCert.certificate)

  log.success('Certificate generated')

  const [key, cert, ca] = await Promise.all([
    fs.promises.readFile(mergedOptions.keyPath, 'utf8'),
    fs.promises.readFile(mergedOptions.certPath, 'utf8'),
    fs.promises.readFile(mergedOptions.certPath, 'utf8'),
  ])

  return { key, cert, ca }
}
