import { createHash } from "crypto"
import MerkleTree, { type Account, type MerkleTreeProps } from "./MerkleTree"
import fs from "fs"
import { confirm, log, note, spinner, text } from "@clack/prompts"
import color from "picocolors"

const hashGeneric = (data: string) => {
  return createHash("sha256").update(data).digest("hex")
}

export const hashData = ({ type, data }: MerkleTreeProps) => {
  if (type === "balances") {
    return data.map((leaf) => {
      const leafToHash = stringifyAccounts([leaf])
      const hashedLeaf = hashGeneric(leafToHash[0])
      return hashedLeaf
    })
  } else {
    return data.map((leaf) => {
      const hashedLeaf = hashGeneric(leaf)
      return hashedLeaf
    })
  }
}

export const hashPair = (left: string, right: string) => {
  const data = Buffer.from(left + right, "hex")
  return createHash("sha256").update(data).digest("hex")
}

export const stringifyAccounts = (accounts: Account[]) => {
  return accounts.map(
    (account) =>
      `${account.identifier}:${account.balances
        .map((b) => `${b.asset}${b.balance}`)
        .join(",")}`
  )
}

export const generateMerkleTree = async (
  data: Account[]
): Promise<MerkleTree> => {
  let startTime = Bun.nanoseconds()
  const s = spinner()
  s.start("Generating merkle tree.")

  const merkleTree = await merkleTreeWorker(data, "balances")

  s.stop("Merkle tree generated.")
  let endTime = Bun.nanoseconds()
  const duration = endTime - startTime

  note(
    `${color.cyan("Leaves")}: ${merkleTree.leaves.length}
${color.cyan("Layers")}: ${merkleTree.layers.length}
${color.cyan("Root")}: ${merkleTree.root}
    
${color.green("Duration")}: ${duration / 1e9} seconds`,
    "Merkle Tree: Details"
  )

  return merkleTree
}

const merkleTreeWorker = async (
  data: Account[] | string[],
  type: "balances" | "generic"
): Promise<MerkleTree> => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url))

  const { leaves, layers }: { leaves: string[]; layers: string[][] } =
    await new Promise((resolve, reject) => {
      worker.postMessage({ type: "generateMerkleBalances", data })

      worker.onmessage = (event) => {
        if (event.data.type === "result") {
          resolve(event.data)
        }
      }

      worker.onerror = (error) => {
        reject(error)
      }
    })

  worker.terminate()

  if (type === "balances") {
    return new MerkleTree({ type, data: data as Account[], leaves, layers })
  } else {
    return new MerkleTree({ type, data: data as string[], leaves, layers })
  }
}

export const validateMerkleTree = async (merkleTree: MerkleTree) => {
  const startTime = Bun.nanoseconds()
  const s = spinner()
  s.start("Validating merkle tree.")
  const worker = new Worker(new URL("./worker.ts", import.meta.url))

  const {
    success,
    completed,
    errors,
  }: { success: boolean; completed: number; errors: number } =
    await new Promise((resolve, reject) => {
      worker.postMessage({
        type: "validate",
        merkleTree,
      })

      worker.onmessage = (event) => {
        if (event.data.type === "result") {
          resolve(event.data)
        }
      }

      worker.onerror = (error) => {
        reject(error)
      }
    })

  worker.terminate()
  const endTime = Bun.nanoseconds()
  const duration = endTime - startTime
  if (success) {
    s.stop(`${completed} leaves were verified in ${duration / 1e9} seconds.`)
  } else {
    s.stop()
    log.error(`${errors} leaves were not verified.`)
  }
}

export const checkAccountType = (data: any[]) => {
  if (!Array.isArray(data)) {
    return "File does not contain an array of accounts."
  }
  for (const account of data) {
    if (typeof account.identifier !== "string") {
      return "Invalid account: identifier must be a string."
    }
    if (!Array.isArray(account.balances)) {
      return "Invalid account: balances must be an array."
    }
    for (const balance of account.balances) {
      if (
        typeof balance.asset !== "string" ||
        typeof balance.balance !== "number"
      ) {
        return "Invalid balance: asset must be a string and balance must be a number."
      }
    }
  }
}

export const handleSave = async (path: string, merkleTree: MerkleTree) => {
  // Check if file exists and confirm to overwrite
  if (fs.existsSync(path)) {
    await confirm({
      message: `File already exists. Overwrite?`,
      initialValue: false,
    }).then(async (confirm): Promise<any> => {
      if (confirm) {
        await workerExport(merkleTree, path)
      } else {
        log.info("File not saved.")
      }
      return
    })
  } else {
    await workerExport(merkleTree, path)
  }
}

const workerExport = async (merkleTree: MerkleTree, path: string) => {
  const startTime = Bun.nanoseconds()
  const s = spinner()
  s.start(`Saving to ${path}...`)
  const worker = new Worker(new URL("./worker.ts", import.meta.url))

  const { success }: { success: boolean } = await new Promise(
    (resolve, reject) => {
      worker.postMessage({
        type: "export",
        merkleTree,
        path,
      })

      worker.onmessage = (event) => {
        if (event.data.type === "result") {
          resolve(event.data)
        }
      }

      worker.onerror = (error) => {
        reject(error)
      }
    }
  )

  worker.terminate()
  const endTime = Bun.nanoseconds()
  const duration = endTime - startTime
  if (success) {
    s.stop(`Successfully saved to ${path} in ${duration / 1e9} seconds.`)
    return { success: true }
  } else {
    s.stop()
    log.error(`An error occurred. Please check the logs.`)
    return { success: false }
  }
}

export const loadData = async () => {
  const s = spinner()
  const dataPathPrompt = await text({
    message: "Enter the path to the accounts file.",
    placeholder: "data.json",
    validate: (input: string) => {
      if (!fs.existsSync(input)) {
        return "File does not exist."
      }
      try {
        JSON.parse(fs.readFileSync(input, "utf-8"))
      } catch (error) {
        return "File does not contain valid JSON."
      }
    },
    defaultValue: "data.json",
    initialValue: "data.json",
  })
  const data = JSON.parse(fs.readFileSync(dataPathPrompt.toString(), "utf-8"))
  s.start("Checking account data.")
  const check = checkAccountType(data)
  if (check !== undefined) {
    log.error(check)
    process.exit(1)
  }
  s.stop("Account data confirmed.")
  return data
}

export const handleDemo = async () => {
  const accountNumberPrompt = await text({
    message: "How many accounts do you want to generate?",
    initialValue: "10",
    validate: (input: string) => {
      const num = Number(input)
      if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
        return "Please enter a positive integer."
      }
    },
  })

  const s = spinner()
  s.start("Generating accounts.")
  const worker = new Worker(new URL("./worker.ts", import.meta.url))

  const { data }: { data: Account[] } = await new Promise((resolve, reject) => {
    worker.postMessage({
      type: "generateAccounts",
      count: Number(accountNumberPrompt),
    })

    worker.onmessage = (event) => {
      if (event.data.type === "result") {
        resolve(event.data)
      }
    }

    worker.onerror = (error) => {
      reject(error)
    }
  })

  worker.terminate()
  s.stop("Accounts generated.")
  return data
}
