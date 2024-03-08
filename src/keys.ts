import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import forge from 'node-forge'
import { log, italic } from '@stacksjs/cli'

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
  // Generate a root key and certificate (self-signed)
  const rootKeys = forge.pki.rsa.generateKeyPair(2048)
  const rootCert = forge.pki.createCertificate()
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
    value: 'Example Root CA',
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
  const pemRootCert = forge.pki.certificateToPem(rootCert)
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

  log.success(`Certificates and private key have been generated and saved to ${saveDir}`)
}

export async function generateRootCA({
  countryName = 'US',
  stateName = 'California',
  localityName = 'Playa Vista',
  organizationName = 'Stacks',
  organizationalUnitName = 'Test',
} = {}) {
  // Generate a root key and certificate (self-signed)
  const rootKeys = forge.pki.rsa.generateKeyPair(2048)
  const rootCert = forge.pki.createCertificate()
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
    value: 'Example Root CA',
  }]
  rootCert.setSubject(rootAttrs)
  rootCert.setIssuer(rootAttrs) // Self-signed, so issuer is the same
  rootCert.sign(rootKeys.privateKey)

  // Convert certificates and key to PEM format
  const pemRootCert = forge.pki.certificateToPem(rootCert)
  const pemRootKey = forge.pki.privateKeyToPem(rootKeys.privateKey)

  // Define the directory to save the keys and certificates
  const saveDir = path.join(os.homedir(), '.stacks', 'ssl', 'keys')
  if (!fs.existsSync(saveDir))
    fs.mkdirSync(saveDir, { recursive: true })

  // Write the PEM-formatted files to disk
  fs.writeFileSync(path.join(saveDir, 'rootCA.crt'), pemRootCert)
  fs.writeFileSync(path.join(saveDir, 'rootCA.key'), pemRootKey)

  log.success(`Root CA has been generated and saved to ${italic(saveDir)}`)
}
