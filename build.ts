import { $ } from 'bun'
import { log } from '@stacksjs/cli'
import { dts } from 'bun-plugin-dtsx'

log.info('Building...')

await Bun.build({
  entrypoints: ['./src/index.ts', './bin/cli.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  external: ['rollup', 'fsevents'],
  plugins: [dts()],
})

await $`cp ./dist/src/index.js ./dist/index.js`
await $`cp ./dist/bin/cli.js ./dist/cli.js`
await $`rm -rf ./dist/src`
await $`rm -rf ./dist/bin`

log.success('Built')
