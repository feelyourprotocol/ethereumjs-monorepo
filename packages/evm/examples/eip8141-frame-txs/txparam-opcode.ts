/**
 * EIP-8141 TXPARAM Opcode Example
 *
 * Demonstrates using the TXPARAM opcode (0xb0) to read
 * transaction-level parameters from within EVM bytecode,
 * when a FrameTransactionContext is active.
 */

import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import { FRAME_MODE, type FrameTransactionContext, createEVM } from '@ethereumjs/evm'
import { Address, bytesToBigInt, hexToBytes } from '@ethereumjs/util'

async function main() {
  const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })
  const evm = await createEVM({ common })

  const sender = new Address(hexToBytes('0x' + 'ab'.repeat(20)))

  const ctx: FrameTransactionContext = {
    txType: 6,
    chainId: 1n,
    nonce: 42n,
    sender,
    maxPriorityFeePerGas: 2n,
    maxFeePerGas: 100n,
    maxFeePerBlobGas: 0n,
    blobVersionedHashes: [],
    sigHash: new Uint8Array(32),
    frames: [
      { mode: FRAME_MODE.VERIFY, target: sender, gasLimit: 100000n, data: new Uint8Array(0) },
      { mode: FRAME_MODE.SENDER, target: sender, gasLimit: 200000n, data: new Uint8Array([0x00]) },
    ],
    currentFrameIndex: 0,
    senderApproved: false,
    payerApproved: false,
    approveCalledInCurrentFrame: false,
    frameResults: [],
    totalGasCost: 5000000n,
    totalBlobGasCost: 0n,
  }
  ;(evm as any).frameTransactionContext = ctx

  // Bytecode: PUSH1 0x00, PUSH1 0x00, TXPARAM (get tx type)
  //           PUSH1 0x00, PUSH1 0x01, TXPARAM (get nonce)
  //           PUSH1 0x00, PUSH1 0x09, TXPARAM (get frame count)
  const code = hexToBytes(
    '0x' +
      '60006000b0' + // TXPARAM(0x00, 0x00) → tx type
      '60006001b0' + // TXPARAM(0x01, 0x00) → nonce
      '60006009b0' + // TXPARAM(0x09, 0x00) → frame count
      '00', // STOP
  )

  const result = await evm.runCode!({ code, gasLimit: 100000n })

  console.log('TXPARAM opcode demonstration:')
  console.log('---')
  console.log('Stack after execution (top first):')

  const stack = result.runState!.stack
  console.log(`  Frame count: ${stack.pop()}`)
  console.log(`  Nonce: ${stack.pop()}`)
  console.log(`  Tx type: ${stack.pop()}`)
  console.log(`  Gas used: ${result.executionGasUsed}`)
  ;(evm as any).frameTransactionContext = undefined
}

main().catch(console.error)
