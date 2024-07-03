import MerkleTree, { type Account } from "./MerkleTree"
import crypto from "crypto"
import { hashData, hashPair } from "./helpers"
import fs from "fs"

declare var self: Worker

type WorkerMessage =
  | { type: "generateMerkleBalances"; data: Account[] }
  | { type: "generateAccounts"; count: number }
  | { type: "generateMerkleGeneric"; data: string[] }
  | { type: "validate"; merkleTree: MerkleTree }
  | { type: "export"; merkleTree: MerkleTree; path: string }

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  try {
    switch (event.data.type) {
      case "generateMerkleBalances":
        handleGenerateMerkleBalances(event.data.data)
        break
      case "generateMerkleGeneric":
        handleGenerateMerkleGeneric(event.data.data)
        break
      case "generateAccounts":
        handleGenerateAccounts(event.data.count)
        break
      case "validate":
        const { merkleTree: merkleTreeValidate } = event.data
        handleValidate(merkleTreeValidate)
        break
      case "export":
        const { merkleTree: merkleTreeExport, path } = event.data
        handleExport(merkleTreeExport, path)
        break
    }
  } catch (error) {
    self.postMessage({ type: "error", message: (error as Error).message })
  }
}

const handleGenerateMerkleBalances = (data: Account[]) => {
  const leaves = hashData({ type: "balances", data })
  const layers = workerBuildTree(leaves)
  self.postMessage({
    type: "result",
    leaves: leaves,
    layers: layers,
  })
}

const handleGenerateMerkleGeneric = (data: string[]) => {
  const leaves = hashData({ type: "generic", data })
  const layers = workerBuildTree(leaves)
  self.postMessage({
    type: "result",
    leaves: leaves,
    layers: layers,
  })
}

const handleGenerateAccounts = (count: number) => {
  let accounts = []
  for (let i = 0; i < count; i++) {
    accounts.push({
      identifier: `ACC${Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, "0")}`,
      balances: [
        { asset: "eth", balance: Math.floor(Math.random() * 10000) },
        { asset: "btc", balance: Math.floor(Math.random() * 10000) },
        { asset: "ftm", balance: Math.floor(Math.random() * 10000) },
        { asset: "inj", balance: Math.floor(Math.random() * 10000) },
        { asset: "fet", balance: Math.floor(Math.random() * 10000) },
      ],
    })
  }
  fs.writeFileSync("data.json", JSON.stringify(accounts, null, 2))
  self.postMessage({
    type: "result",
    data: accounts,
  })
}

const handleValidate = (merkleTree: MerkleTree) => {
  let completed = 0
  let errors = 0

  for (let i = 0; i < merkleTree.leaves.length; i++) {
    const leaf = merkleTree.leaves[i]
    const proof = getProof(i, merkleTree.layers)
    const check = verifyLeaf(leaf, proof, merkleTree.root)
    if (check) {
      completed++
    } else {
      errors++
    }
  }
  self.postMessage({
    type: "result",
    success: errors === 0,
    completed: completed,
    errors: errors,
  })
}

const handleExport = (merkleTree: MerkleTree, path: string) => {
  const exportData = {
    root: merkleTree.root,
    leaves: merkleTree.leaves.map((leaf, index) => ({
      index,
      hash: leaf,
      data: merkleTree.data[index],
      proof: getProof(index, merkleTree.layers),
    })),
  }
  fs.writeFileSync(path, JSON.stringify(exportData, null, 2))
  self.postMessage({
    type: "result",
    success: true,
  })
}

const getProof = (index: number, layers: string[][]) => {
  const proof: Array<{ sibling: string; direction: "left" | "right" }> = []
  let currentIndex = index

  for (let i = 0; i < layers.length - 1; i++) {
    const currentLayer = layers[i]
    const isRightNode = currentIndex % 2 === 1
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1

    if (siblingIndex < currentLayer.length) {
      proof.push({
        sibling: currentLayer[siblingIndex],
        direction: isRightNode ? "left" : "right",
      })
    } else {
      // If there's no sibling (last leaf in an odd-length layer),
      // use the current node as its own sibling
      proof.push({
        sibling: currentLayer[currentIndex],
        direction: "right",
      })
    }

    currentIndex = Math.floor(currentIndex / 2)
  }

  return proof
}

const verifyLeaf = (
  leaf: string,
  proof: Array<{ sibling: string; direction: "left" | "right" }>,
  root: string
) => {
  let computedHash = leaf

  for (const { sibling, direction } of proof) {
    if (direction === "left") {
      computedHash = hashPair(sibling, computedHash)
    } else {
      computedHash = hashPair(computedHash, sibling)
    }
  }

  return computedHash === root
}

const workerBuildTree = (leaves: string[]) => {
  let currentLayer = leaves
  let layers: string[][] = [leaves]
  while (currentLayer.length > 1) {
    const newLayer: string[] = []
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i]
      const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left
      newLayer.push(hashPair(left, right))
    }
    layers.push(newLayer)
    currentLayer = newLayer
  }
  return layers
}
