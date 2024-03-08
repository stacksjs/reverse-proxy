import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import forge from 'node-forge'
import { italic, log, runCommandSync } from '@stacksjs/cli'

// Function to generate and save keys, certificates, and CA bundle
export async function generateAndSaveCertificates({
  commonName = 'stacks.localhost',
  countryName = 'US',
  stateName = 'California',
  localityName = 'Playa Vista',
  organizationName = 'Stacks',
  organizationalUnitName = 'Test',
  validityYears = 1,
} = {}) {
  try {
    const rootCAPath = path.join(os.homedir(), '.stacks', 'ssl', 'keys');
    const certPath = path.join(rootCAPath, 'rootCA.crt');
    const keyPath = path.join(rootCAPath, 'rootCA.key');

    // Ensure the directory exists
    if (!fs.existsSync(rootCAPath)) {
      fs.mkdirSync(rootCAPath, { recursive: true });
    }

    // Check if the Root CA files exist, generate if they do not
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      await generateRootCA({
        countryName,
        stateName,
        localityName,
        organizationName,
        organizationalUnitName,
      });
    }

    // Now that we're sure the root CA exists, proceed to load it
    const pemRootCert = fs.readFileSync(certPath, 'utf8');
    const pemRootKey = fs.readFileSync(keyPath, 'utf8');

    const rootCert = forge.pki.certificateFromPem(pemRootCert)
    const rootPrivateKey = forge.pki.privateKeyFromPem(pemRootKey)
    // Assuming the public key needs to be derived from the private key
    const rootPublicKey = forge.pki.setRsaPublicKey(rootPrivateKey.n, rootPrivateKey.e)
    const rootKeys = { privateKey: rootPrivateKey, publicKey: rootPublicKey }

    rootCert.publicKey = rootKeys.publicKey
    rootCert.serialNumber = '01'
    rootCert.validity.notBefore = new Date()
    rootCert.validity.notAfter = new Date()
    rootCert.validity.notAfter.setFullYear(rootCert.validity.notBefore.getFullYear() + validityYears)
    const rootAttrs = [{
      name: 'countryName',
      value: countryName,
    }, {
      name: 'stateOrProvinceName',
      value: stateName,
    }, {
      name: 'localityName',
      value: localityName,
    }, {
      name: 'organizationName',
      value: organizationName,
    }, {
      name: 'organizationalUnitName',
      value: organizationalUnitName,
    }, {
      name: 'commonName',
      value: 'Stacks Root CA',
    }]
    rootCert.setSubject(rootAttrs)
    rootCert.setIssuer(rootAttrs) // Self-signed, so issuer is the same
    rootCert.sign(rootKeys.privateKey)

    // Generate a keypair and create an X.509v3 certificate for the domain
    const keys = forge.pki.rsa.generateKeyPair(2048)
    const cert = forge.pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = '01'
    cert.validity.notBefore = new Date()
    cert.validity.notAfter = new Date()
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + validityYears)
    const attrs = [{
      name: 'countryName',
      value: countryName,
    }, {
      name: 'stateOrProvinceName',
      value: stateName,
    }, {
      name: 'localityName',
      value: localityName,
    }, {
      name: 'organizationName',
      value: organizationName,
    }, {
      name: 'organizationalUnitName',
      value: organizationalUnitName,
    }, {
      name: 'commonName',
      value: commonName,
    }]
    cert.setSubject(attrs)
    cert.setIssuer(rootAttrs) // Issued by the root CA
    cert.sign(rootKeys.privateKey) // Signed with the root CA's private key

    // Convert certificates and key to PEM format
    const pemCert = forge.pki.certificateToPem(cert)
    const pemKey = forge.pki.privateKeyToPem(keys.privateKey)

    // Bundle root certificate (and intermediates if any) into a CA bundle
    const caBundle = pemRootCert // + pemIntermediateCert; if you have intermediates

    // Define the directory to save the keys and certificates
    const saveDir = path.join(os.homedir(), '.stacks', 'ssl', 'keys')
    if (!fs.existsSync(saveDir))
      fs.mkdirSync(saveDir, { recursive: true })

    // Write the PEM-formatted files to disk
    fs.writeFileSync(path.join(saveDir, `${commonName}.crt`), pemCert)
    fs.writeFileSync(path.join(saveDir, 'rootCA.crt'), pemRootCert)
    fs.writeFileSync(path.join(saveDir, `${commonName}.ca-bundle`), caBundle)
    fs.writeFileSync(path.join(saveDir, `${commonName}.key`), pemKey)

    log.success(`Certificates and private key have been generated and saved to ${italic(saveDir)}`)
  }
  catch (error) {
    log.error('Failed to generate or save certificates:', error)
  }
}

export async function addRootCAToSystemTrust() {
  log.info('Ensuring root CA is added to the system trust store')

  const CERT_PATH = path.join(os.homedir(), '.stacks', 'ssl', 'keys', 'rootCA.crt')
  let command = ''

  switch (os.type()) {
    case 'Linux':
      // Assuming Linux uses the standard /usr/local/share/ca-certificates directory
      const DEST_PATH = '/usr/local/share/ca-certificates/rootCA.crt'
      command = `sudo cp "${CERT_PATH}" "${DEST_PATH}" && sudo update-ca-certificates`
      break
    case 'Darwin':
      // macOS
      command = `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${CERT_PATH}"`
      break
    case 'Windows_NT':
      // Windows, using PowerShell
      command = `powershell.exe -Command "Import-Certificate -FilePath '${CERT_PATH}' -CertStoreLocation Cert:\\LocalMachine\\Root"`
      break
    default:
      log.error('OS not supported')
      return
  }

  try {
    const result = await runCommandSync(command)
    console.log(result)
    log.success('Root CA is added in the system trust store')
  }
  catch (error) {
    log.error('Failed to execute command')
    log.error(error)
  }
}

export async function generateRootCA({
  countryName = 'US',
  stateName = 'California',
  localityName = 'Playa Vista',
  organizationName = 'Stacks',
  organizationalUnitName = 'Test',
} = {}) {
  const rootCAPath = path.join(os.homedir(), '.stacks', 'ssl', 'keys')
  const certPath = path.join(rootCAPath, 'rootCA.crt')
  const keyPath = path.join(rootCAPath, 'rootCA.key')

  // Ensure the directory exists
  if (!fs.existsSync(rootCAPath))
    fs.mkdirSync(rootCAPath, { recursive: true })

  let rootCert
  let rootKeys

  // Check if the Root CA files exist
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    // Load existing Root CA
    const pemRootCert = fs.readFileSync(certPath, 'utf8')
    const pemRootKey = fs.readFileSync(keyPath, 'utf8')
    rootCert = forge.pki.certificateFromPem(pemRootCert)
    rootKeys = { privateKey: forge.pki.privateKeyFromPem(pemRootKey) }
  }
  else {
    // Generate new Root CA
    rootKeys = forge.pki.rsa.generateKeyPair(2048)
    rootCert = forge.pki.createCertificate()
    rootCert.publicKey = rootKeys.publicKey
    rootCert.serialNumber = '01'
    rootCert.validity.notBefore = new Date()
    rootCert.validity.notAfter = new Date()
    rootCert.validity.notAfter.setFullYear(rootCert.validity.notBefore.getFullYear() + 1)
    const rootAttrs = [{
      name: 'countryName',
      value: countryName,
    }, {
      name: 'stateOrProvinceName',
      value: stateName,
    }, {
      name: 'localityName',
      value: localityName,
    }, {
      name: 'organizationName',
      value: organizationName,
    }, {
      name: 'organizationalUnitName',
      value: organizationalUnitName,
    }, {
      name: 'commonName',
      value: 'Stacks Root CA',
    }]
    rootCert.setSubject(rootAttrs)
    rootCert.setIssuer(rootAttrs) // Self-signed
    rootCert.sign(rootKeys.privateKey, forge.md.sha256.create())

    // Convert to PEM format
    const pemRootCert = forge.pki.certificateToPem(rootCert)
    const pemRootKey = forge.pki.privateKeyToPem(rootKeys.privateKey)

    // Save the new Root CA to files
    fs.writeFileSync(certPath, pemRootCert)
    fs.writeFileSync(keyPath, pemRootKey)
  }

  log.success(`Root CA has been generated and saved to ${italic(rootCAPath)}`)

  return { certPath, keyPath }
}
