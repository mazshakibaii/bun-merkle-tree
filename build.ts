await Bun.build({
  entrypoints: ["./src/index.tsx"],
  outdir: "./out/bun",
  target: "bun",
})
