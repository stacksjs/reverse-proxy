# Install

## Bun & Node.js

```bash
bun install -d @stacksjs/rpx
npm install -g @stacksjs/rpx

# or, invoke immediately
bunx @stacksjs/rpx
npx @stacksjs/rpx
```

_We are looking to publish this package npm under the name `rpx`. We are also hoping npm will release the name for us._

## Binaries

For now, you can download the `rpx` binaries from the [releases page](https://github.com/stacksjs/rpx/releases/tag/v0.9.1). Choose the binary that matches your platform and architecture:

## macOS (Darwin)

For M1/M2 Macs (arm64):

```bash
# Download the binary
curl -L https://github.com/stacksjs/rpx/releases/download/v0.9.1/rpx-darwin-arm64 -o rpx

# Make it executable
chmod +x rpx

# Move it to your PATH
mv rpx /usr/local/bin/rpx
```

For Intel Macs (amd64):

```bash
# Download the binary
curl -L https://github.com/stacksjs/rpx/releases/download/v0.9.1/rpx-darwin-x64 -o rpx

# Make it executable
chmod +x rpx

# Move it to your PATH
mv rpx /usr/local/bin/rpx
```

## Linux

For ARM64:

```bash
# Download the binary
curl -L https://github.com/stacksjs/rpx/releases/download/v0.9.1/rpx-linux-arm64 -o rpx

# Make it executable
chmod +x rpx

# Move it to your PATH
mv rpx /usr/local/bin/rpx
```

For x64:

```bash
# Download the binary
curl -L https://github.com/stacksjs/rpx/releases/download/v0.9.1/rpx-linux-x64 -o rpx

# Make it executable
chmod +x rpx

# Move it to your PATH
mv rpx /usr/local/bin/rpx
```

## Windows

For x64:

```bash
# Download the binary
curl -L https://github.com/stacksjs/rpx/releases/download/v0.9.1/rpx-windows-x64.exe -o rpx.exe

# Move it to your PATH (adjust the path as needed)
move rpx.exe C:\Windows\System32\rpx.exe
```
