<p align="center"><img src=".github/art/cover.jpg" alt="Social Card of this repo"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# A Better Developer Experience

> A reverse proxy for local development with SSL support, custom domains, and more.

## ☘️ Features

- Reverse Proxy
- SSL Support
- Custom Domains
- Auto HTTP to HTTPS Redirection
- /etc/hosts Management
- Dependency-free Binary

## 🤖 Usage

```bash
bun install -d bun-reverse-proxy
# brew install reverse-proxy
# pkgx install reverse-proxy
```

Now, you can use it in your project:

```js
import { startProxy } from 'bun-reverse-proxy'

startProxy({
  from: 'localhost:3000',
  to: 'my-project.localhost' // or try 'my-project.test'
})
```

### CLI

```bash
reverse-proxy --from localhost:3000 --to my-project.localhost
reverse-proxy --from localhost:3000 --to my-project.test --keyPath ./key.pem --certPath ./cert.pem
reverse-proxy --help
reverse-proxy --version
```

### Configuration

You can also use a configuration file:

```ts
export default {
  'localhost:3000': 'stacks.localhost'
}
```

Then run:

```bash
reverse-proxy start
```

And your config will be loaded from `reverse-proxy.config.ts` _(or `reverse-proxy.config.js`)_. Learn more in the docs.

## Testing

```bash
bun test
```

## Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
