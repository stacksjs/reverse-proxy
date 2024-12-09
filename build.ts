import { $ } from 'bun'
import { log } from '@stacksjs/cli'
import { dts } from 'bun-plugin-dtsx'

log.info('Building...')

await Bun.build({
  entrypoints: ['./src/index.ts', './bin/cli.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  minify: true,
  splitting: true,
  plugins: [dts()],
})

log.success('Built')
