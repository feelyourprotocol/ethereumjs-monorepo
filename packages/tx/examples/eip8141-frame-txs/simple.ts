import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import { createFrameEIP8141Tx } from '@ethereumjs/tx'
import { bytesToHex, hexToBytes } from '@ethereumjs/util'

// Enable EIP-8141 on Common
const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })

// Sender address (in a real scenario, this would be a smart account)
const sender = hexToBytes(`0x${'aa'.repeat(20)}`)

// Build a minimal Frame Transaction with two frames:
//  - Frame 0: VERIFY frame (mode=1) — would contain signature data in production
//  - Frame 1: SENDER frame (mode=2) — the actual execution call
const tx = createFrameEIP8141Tx(
  {
    nonce: 0,
    sender,
    frames: [
      // VERIFY frame: mode=1, target=null (sender), gas=65536, data=placeholder signature
      [
        new Uint8Array([1]),
        new Uint8Array(0),
        new Uint8Array([0x01, 0x00, 0x00]),
        new Uint8Array([0x20, 0x01]),
      ],
      // SENDER frame: mode=2, target=some address, gas=100000, data=empty
      [
        new Uint8Array([2]),
        hexToBytes(`0x${'bb'.repeat(20)}`),
        new Uint8Array([0x01, 0x86, 0xa0]),
        new Uint8Array(0),
      ],
    ],
    maxPriorityFeePerGas: 1_000_000_000n,
    maxFeePerGas: 50_000_000_000n,
    maxFeePerBlobGas: 0n,
    blobVersionedHashes: [],
  },
  { common },
)

console.log(`EIP-8141 Frame TX created`)
console.log(`  Type:      ${tx.type} (0x06)`)
console.log(`  Sender:    ${bytesToHex(tx.sender.bytes)}`)
console.log(`  Nonce:     ${tx.nonce}`)
console.log(`  Frames:    ${tx.frames.length}`)
console.log(`  Gas Limit: ${tx.gasLimit} (computed from frames)`)
console.log(`  Hash:      ${bytesToHex(tx.hash())}`)
console.log(`  Signed:    ${tx.isSigned()} (Frame TX has no ECDSA signature)`)
console.log(`  Serialized size: ${tx.serialize().length} bytes`)
