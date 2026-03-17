/**
 * EIP-8141 Simple Frame Transaction (Example 1)
 *
 * Demonstrates a basic "Simple Transaction" flow:
 *   Frame 0: VERIFY (mode 1) — ECDSA signature verification + APPROVE
 *   Frame 1: SENDER (mode 2) — RLP-encoded call batch
 *
 * This is the default EOA path where the sender has no deployed
 * code, so the VM uses "default code" to process each frame.
 */

import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import { RLP } from '@ethereumjs/rlp'
import { type FrameEIP8141TxData, createFrameEIP8141Tx } from '@ethereumjs/tx'
import {
  Account,
  Address,
  BIGINT_0,
  bigIntToUnpaddedBytes,
  concatBytes,
  ecrecover,
  hexToBytes,
  privateToPublic,
  publicToAddress,
} from '@ethereumjs/util'
import { keccak256 } from 'ethereum-cryptography/keccak.js'
import { secp256k1 } from 'ethereum-cryptography/secp256k1.js'

import { createVM, runTx } from '../../src/index.ts'

const PRIVATE_KEY = hexToBytes('0x' + 'ab'.repeat(32))
const PUBLIC_KEY = privateToPublic(PRIVATE_KEY)
const SENDER_ADDR = new Address(publicToAddress(PUBLIC_KEY))

function buildVerifyData(scope: number, sigHash: Uint8Array, privateKey: Uint8Array): Uint8Array {
  const byte0 = ((scope & 0xf) << 4) | 0x00
  const dataWithoutSig = new Uint8Array([byte0])
  const hash = keccak256(concatBytes(sigHash, dataWithoutSig))

  const sig = secp256k1.sign(hash, privateKey.slice(0, 32))
  const r = sig.r
  const s = sig.s
  const v = sig.recovery + 27

  const rBytes = bigIntToUnpaddedBytes(r)
  const sBytes = bigIntToUnpaddedBytes(s)
  const rPadded = new Uint8Array(32)
  rPadded.set(rBytes, 32 - rBytes.length)
  const sPadded = new Uint8Array(32)
  sPadded.set(sBytes, 32 - sBytes.length)

  return concatBytes(new Uint8Array([byte0, v]), rPadded, sPadded)
}

async function main() {
  const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })
  const vm = await createVM({ common })

  // Fund the sender
  const initialBalance = BigInt('10000000000000000') // 0.01 ETH
  await vm.stateManager.putAccount(SENDER_ADDR, new Account(0n, initialBalance))

  console.log('EIP-8141 Simple Frame Transaction')
  console.log('==================================')
  console.log(`Sender: ${SENDER_ADDR.toString()}`)
  console.log(`Initial balance: ${initialBalance}`)

  // Build SENDER frame data: one simple value transfer
  const recipient = new Address(hexToBytes('0x' + 'cc'.repeat(20)))
  const transferValue = BigInt(1000)
  const senderRlp = RLP.encode([
    [recipient.bytes, bigIntToUnpaddedBytes(transferValue), new Uint8Array(0)],
  ])
  const senderFrameData = concatBytes(new Uint8Array([0x00]), senderRlp)

  // Build the frame tx (VERIFY data is a placeholder; we'll fill it after getting sigHash)
  const txData: FrameEIP8141TxData = {
    chainId: 1n,
    nonce: 0n,
    sender: SENDER_ADDR.toString() as `0x${string}`,
    maxPriorityFeePerGas: 1n,
    maxFeePerGas: 100n,
    maxFeePerBlobGas: 0n,
    frames: [
      [new Uint8Array([1]), new Uint8Array(0), bigIntToUnpaddedBytes(50000n), new Uint8Array(0)],
      [new Uint8Array([2]), new Uint8Array(0), bigIntToUnpaddedBytes(200000n), senderFrameData],
    ],
  }

  const txPlaceholder = createFrameEIP8141Tx(txData, { common })
  const sigHash = txPlaceholder.getHashedMessageToSign()
  const verifyData = buildVerifyData(0x2, sigHash, PRIVATE_KEY)

  // Rebuild with actual VERIFY data
  const rawFrames = (txPlaceholder as any).frames as [
    Uint8Array,
    Uint8Array,
    Uint8Array,
    Uint8Array,
  ][]
  rawFrames[0][3] = verifyData

  const tx = createFrameEIP8141Tx({ ...txData, frames: rawFrames }, { common })

  console.log(`\nTransaction type: ${tx.type}`)
  console.log(`Computed gasLimit: ${tx.gasLimit}`)
  console.log(`Frame count: ${(tx as any).frames.length}`)

  try {
    const result = await runTx(vm, {
      tx: tx as any,
      skipBalance: true,
      skipNonce: true,
      skipHardForkValidation: true,
    })

    console.log(`\nExecution result:`)
    console.log(`  Total gas spent: ${result.totalGasSpent}`)
    console.log(`  Gas refund: ${result.gasRefund}`)

    const senderAfter = await vm.stateManager.getAccount(SENDER_ADDR)
    console.log(`  Sender balance after: ${senderAfter!.balance}`)
    console.log(`  Sender nonce after: ${senderAfter!.nonce}`)

    const recipientAccount = await vm.stateManager.getAccount(recipient)
    console.log(`  Recipient balance: ${recipientAccount?.balance ?? BIGINT_0}`)
  } catch (e: any) {
    console.error(`Execution error: ${e.message}`)
  }
}

main().catch(console.error)
