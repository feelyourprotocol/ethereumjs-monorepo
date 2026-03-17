/**
 * EIP-8141 VERIFY Frame Failure
 *
 * Demonstrates what happens when a VERIFY frame fails:
 * - Invalid signature data causes default code verification to fail
 * - APPROVE is never called, making the frame transaction invalid
 * - The entire transaction is rejected
 */

import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import { type FrameEIP8141TxData, createFrameEIP8141Tx } from '@ethereumjs/tx'
import {
  Account,
  Address,
  bigIntToUnpaddedBytes,
  hexToBytes,
  privateToPublic,
  publicToAddress,
} from '@ethereumjs/util'

import { createVM, runTx } from '../../src/index.ts'

const PRIVATE_KEY = hexToBytes('0x' + 'ab'.repeat(32))
const PUBLIC_KEY = privateToPublic(PRIVATE_KEY)
const SENDER_ADDR = new Address(publicToAddress(PUBLIC_KEY))

async function main() {
  const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })
  const vm = await createVM({ common })

  await vm.stateManager.putAccount(SENDER_ADDR, new Account(0n, BigInt('10000000000000000')))

  console.log('EIP-8141 VERIFY Frame Failure Demo')
  console.log('===================================')
  console.log(`Sender: ${SENDER_ADDR.toString()}`)

  // Build a VERIFY frame with intentionally invalid data (just a single 0x00 byte).
  // The default code expects [byte0, v, r(32), s(32)] = 66 bytes for secp256k1 sig.
  const txData: FrameEIP8141TxData = {
    chainId: 1n,
    nonce: 0n,
    sender: SENDER_ADDR.toString() as `0x${string}`,
    maxPriorityFeePerGas: 1n,
    maxFeePerGas: 100n,
    maxFeePerBlobGas: 0n,
    frames: [
      [
        new Uint8Array([1]), // mode = VERIFY
        new Uint8Array(0), // target = sender (empty)
        bigIntToUnpaddedBytes(50000n),
        new Uint8Array([0x00]), // invalid: too short for secp256k1 sig
      ],
    ],
  }

  const tx = createFrameEIP8141Tx(txData, { common })

  console.log(`\nTransaction type: ${tx.type}`)
  console.log(`Frame count: ${(tx as any).frames.length}`)
  console.log(`VERIFY frame data length: 1 byte (needs 66 for valid secp256k1 sig)`)
  console.log(`\nExpected behavior: VERIFY fails → APPROVE not called → tx rejected`)

  try {
    await runTx(vm, {
      tx: tx as any,
      skipBalance: true,
      skipNonce: true,
      skipHardForkValidation: true,
    })
    console.log('\nUnexpected: transaction succeeded (should have been rejected)')
  } catch (e: any) {
    console.log(`\nTransaction correctly rejected!`)
    console.log(`  Error: ${e.message}`)
  }

  const senderAfter = await vm.stateManager.getAccount(SENDER_ADDR)
  console.log(`\n  Sender balance (unchanged): ${senderAfter!.balance}`)
  console.log(`  Sender nonce (unchanged): ${senderAfter!.nonce}`)
}

main().catch(console.error)
