#!/bin/bash

 #/ Add the root CA to the system trust store
 # This script is used to add the root CA to the system trust store.
 #
 # Usage:
 #
 # 1. Run the script - ./add-root-ca.sh
 # 2. Enter the password when prompted
 # 3. The root CA will be added to the system trust store
 #/

CERT_PATH="$HOME/.stacks/ssl/keys/rootCA.crt"
DEST_PATH="/usr/local/share/ca-certificates/rootCA.crt"

if [[ "$OSTYPE" == "linux-gnu"# ]]; then
    if [ -f "$DEST_PATH" ]; then
        echo "$DEST_PATH already exists."
        read -p "Do you want to overwrite it? [y/N] " -n 1 -r
        echo   # move to a new line
        if [[ ! $REPLY =~ ^[Yy]$ ]]
        then
            echo "Operation cancelled."
            exit 1
        fi
    fi
    sudo cp "$CERT_PATH" "$DEST_PATH"
    sudo update-ca-certificates
elif [[ "$OSTYPE" == "darwin"* ]]; then
    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$CERT_PATH"
elif [[ "$OSTYPE" == "cygwin" || "$OSTYPE" == "msys" ]]; then
    powershell.exe -Command "Import-Certificate -FilePath '$CERT_PATH' -CertStoreLocation Cert:\LocalMachine\Root"
else
    echo "OS not supported"
fi
