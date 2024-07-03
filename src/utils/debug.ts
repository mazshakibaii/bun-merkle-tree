import type MerkleTree from "./MerkleTree"

export const debug = (
  merkleTree: MerkleTree,
  proofIndex: number,
  hashedLeaves: string[]
) => {
  console.log("Tree structure:")
  merkleTree.layers.forEach((layer, index) => {
    console.log(`Level ${index}: ${layer.length} nodes`)
    console.log(layer)
  })

  const root = merkleTree.getRoot()
  console.log("Merkle Root:", root)

  const proof = merkleTree.getProof(proofIndex)
  console.log("Proof:", JSON.stringify(proof, null, 2))
  console.log("Proof length:", proof.length)

  const leafToVerify = hashedLeaves[proofIndex]
  console.log("Leaf to verify:", leafToVerify)

  const isValid = merkleTree.verify(leafToVerify, proof, root)
  console.log("Is leaf valid?", isValid)

  // Manual verification
  console.log("\nManual Verification:")
  let computedHash = leafToVerify
  for (const { sibling, direction } of proof) {
    console.log(
      "Computing hash of:",
      direction === "left"
        ? `${sibling} + ${computedHash}`
        : `${computedHash} + ${sibling}`
    )
    if (direction === "left") {
      computedHash = merkleTree.hash(sibling, computedHash)
    } else {
      computedHash = merkleTree.hash(computedHash, sibling)
    }
    console.log("Computed hash:", computedHash)
  }
  console.log("Final computed hash:", computedHash)
  console.log("Matches root?", computedHash === root)
}
