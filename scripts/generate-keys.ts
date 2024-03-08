import { generateAndSaveCertificates, generateRootCA } from '../src/keys'

// Generate a root key and certificate (self-signed)
generateRootCA()

// Generate a keypair and create an X.509v3 certificate for the domain
generateAndSaveCertificates()
