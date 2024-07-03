import color from "picocolors"
import {
  generateMerkleTree,
  handleDemo,
  handleSave,
  loadData,
  validateMerkleTree,
} from "./utils/helpers"
import MerkleTree, { type Account } from "./utils/MerkleTree"
import { spinner, text, confirm, log, note, intro, outro } from "@clack/prompts"

const isDemo = Bun.argv.includes("--demo")

intro(color.bold(color.bgBlue(" Merkle Tree Generator ")))

if (isDemo) {
  log.warn("Launching in demo mode, accounts will be generated.")
}

note(`This tool will generate a merkle tree for a given set of accounts.`)

let accounts: Account[] = []

if (!isDemo) {
  accounts = await loadData()
} else {
  accounts = await handleDemo()
}

const merkleTree = await generateMerkleTree(accounts)

await confirm({
  message: "Do you want to validate the tree? (check all proofs)",
}).then(async (verify) => {
  if (verify) {
    await validateMerkleTree(merkleTree)
  } else {
    log.info("Leaves were not verified.")
  }
})

await text({
  message: "Enter the path to save the data.",
  placeholder: "export.json",
  initialValue: "export.json",
  validate: (input: string) => {
    if (!input.endsWith(".json")) {
      return "Must be saved as a .json file"
    }
  },
}).then(async (path) => {
  await handleSave(path.toString(), merkleTree)
})

log.success("Completed!")
