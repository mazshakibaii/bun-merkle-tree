# Bun Merkle Tree

## Using worker threads to generate a merkle tree from a large dataset.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
```

Use the `--demo` flag to generate account data, or use regularly to import your own data. It currently only supports the following data type:

```ts
type Account = {
  identifier: string
  balances: {
    asset: string
    amount: number
  }[]
}
```

Support for generic string data will be added soon.
