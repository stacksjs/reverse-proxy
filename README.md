<p align="center"><img src="https://github.com/stacksjs/reverse-proxy/blob/main/.github/art/cover.jpg?raw=true" alt="Social Card of this repo"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# A Better Developer Experience

> A zero-config reverse proxy for local development with SSL support, custom domains, and more.

## Features

- Simple Reverse Proxy
- Custom Domains _(with wildcard support)_
- Dependency-Free
- Zero-Config Setup
<!-- - SSL Support _(HTTPS by default)_ -->
<!-- - Auto HTTP-to-HTTPS Redirection -->
<!-- - `/etc/hosts` Management _(auto-updating)_ -->

## Install

```bash
bun install -d @stacksjs/reverse-proxy
```

<!-- _Alternatively, you can install:_

```bash
brew install reverse-proxy # wip
pkgx install reverse-proxy # wip
``` -->

## Get Started

There are two ways of using this reverse proxy: _as a library or as a CLI._

### Library

Given the npm package is installed:

```js
import { startProxy } from '@stacksjs/reverse-proxy'

startProxy({
  from: 'localhost:3000',
  to: 'my-project.localhost' // or try 'my-project.test'
})
```

### CLI

```bash
reverse-proxy --from localhost:3000 --to my-project.localhost
reverse-proxy --from localhost:8080 --to my-project.test --keyPath ./key.pem --certPath ./cert.pem
reverse-proxy --help
reverse-proxy --version
```

## Configuration

The Reverse Proxy can be configured using a `reverse-proxy.config.ts` _(or `reverse-proxy.config.js`)_ file and it will be automatically loaded when running the `reverse-proxy` command.

```ts
// reverse-proxy.config.ts (or reverse-proxy.config.js)
export default {
  'localhost:3000': 'stacks.localhost'
}
```

_Then run:_

```bash
reverse-proxy start
```

To learn more, head over to the [documentation](https://reverse-proxy.sh/).

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

## Postcardware

Two things are true: Stacks OSS will always stay open-source, and we do love to receive postcards from wherever Stacks is used! 🌍 _We also publish them on our website. And thank you, Spatie_

Our address: Stacks.js, 12665 Village Ln #2306, Playa Vista, CA 90094

## Sponsors

We would like to extend our thanks to the following sponsors for funding Stacks development. If you are interested in becoming a sponsor, please reach out to us.

- [JetBrains](https://www.jetbrains.com/)
- [The Solana Foundation](https://solana.com/)

## Credits

- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@stacksjs/reverse-proxy?style=flat-square
[npm-version-href]: https://npmjs.com/package/@stacksjs/reverse-proxy
[github-actions-src]: https://img.shields.io/github/actions/workflow/status/stacksjs/reverse-proxy/ci.yml?style=flat-square&branch=main
[github-actions-href]: https://github.com/stacksjs/reverse-proxy/actions?query=workflow%3Aci

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/stacksjs/reverse-proxy/main?style=flat-square
[codecov-href]: https://codecov.io/gh/stacksjs/reverse-proxy -->
