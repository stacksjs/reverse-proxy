import { $ } from 'bun'

await $`mv ./bin/reverse-proxy ./dist/reverse-proxy`
await $`cp ./dist/reverse-proxy ./rp`
