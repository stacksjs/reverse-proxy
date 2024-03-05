await Bun.build({
  entrypoints: [
    'src/index.ts',
  ],

  outdir: './dist',

  // plugins: [
  //     dts(),
  // ],
})
