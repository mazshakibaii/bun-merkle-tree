import crypto from "crypto"
import { hashData, hashPair } from "./helpers"

export type Account = {
  identifier: string
  balances: { asset: string; balance: number }[]
}

export type MerkleTreeProps = MerkleTreeBalancesProps | MerkleTreeGenericProps

type MerkleTreeBalancesProps = {
  type: "balances"
  data: Account[]
  leaves?: string[]
  layers?: string[][]
  root?: string
}

type MerkleTreeGenericProps = {
  type: "generic"
  data: string[]
  leaves?: string[]
  layers?: string[][]
  root?: string
}

export default class MerkleTree {
  public readonly leaves: string[]
  public readonly layers: string[][]
  public readonly data: string[] | Account[]
  public readonly root: string

  constructor({ type, data, leaves, layers, root }: MerkleTreeProps) {
    if (leaves && layers && root) {
      // Pre-created Merkle Tree (for use with larger datasets)
      this.leaves = leaves
      this.layers = layers
      this.data = data
      this.root = root
      return
    } else {
      // Create a new Merkle Tree
      this.data = data
      this.leaves =
        type === "balances"
          ? hashData({ type, data })
          : hashData({ type, data }) // Stupid type fix - wtf?
      this.layers = [this.leaves]
      this.buildTree()
      this.root = this.layers[this.layers.length - 1][0]
    }
  }

  public hashPair(left: string, right: string): string {
    const data = Buffer.from(left + right, "hex")
    return crypto.createHash("sha256").update(data).digest("hex")
  }

  private buildTree(): void {
    let currentLayer = this.leaves
    while (currentLayer.length > 1) {
      const newLayer: string[] = []
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i]
        const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left
        newLayer.push(this.hashPair(left, right))
      }
      this.layers.push(newLayer)
      currentLayer = newLayer
    }
  }

  public getProof(
    index: number
  ): Array<{ sibling: string; direction: "left" | "right" }> {
    const proof: Array<{ sibling: string; direction: "left" | "right" }> = []
    let currentIndex = index

    for (let i = 0; i < this.layers.length - 1; i++) {
      const currentLayer = this.layers[i]
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

  public verifyLeaf(
    leaf: string,
    proof: Array<{ sibling: string; direction: "left" | "right" }>,
    root: string
  ): boolean {
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

  public verifyTree(): { status: boolean; completed: number; errors: number } {
    let completed = 0
    let errors = 0

    const root = this.root
    for (let i = 0; i < this.leaves.length; i++) {
      const leaf = this.leaves[i]
      const proof = this.getProof(i)
      if (!this.verifyLeaf(leaf, proof, root)) {
        errors++
      } else {
        completed++
      }
    }
    return { status: errors === 0, completed, errors }
  }

  public export(): object {
    const exportData = {
      root: this.root,
      leaves: this.leaves.map((leaf, index) => ({
        index,
        hash: leaf,
        data: this.data[index],
        proof: this.getProof(index),
      })),
    }

    return exportData
  }
}
