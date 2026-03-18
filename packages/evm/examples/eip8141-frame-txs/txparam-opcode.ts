/**
 * EIP-8141 TXPARAM Opcode Example
 *
 * Demonstrates using the TXPARAM opcode (0xb0) to read
 * transaction-level parameters from within EVM bytecode,
 * when a FrameExecutionContext is active.
 */

import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import { FRAME_MODE, type FrameExecutionState, type ParsedFrame, createEVM } from '@ethereumjs/evm'
import { type FrameEIP8141TxData, createFrameEIP8141Tx } from '@ethereumjs/tx'
import { Address, bigIntToUnpaddedBytes, hexToBytes } from '@ethereumjs/util'

async function main() {
  const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })
  const evm = await createEVM({ common })

  const senderHex = '0x' + 'ab'.repeat(20)
  const sender = new Address(hexToBytes(senderHex))

  const txData: FrameEIP8141TxData = {
    chainId: 1n,
    nonce: 42n,
    sender: senderHex as `0x${string}`,
    maxPriorityFeePerGas: 2n,
    maxFeePerGas: 100n,
    maxFeePerBlobGas: 0n,
    frames: [
      [new Uint8Array([1]), new Uint8Array(0), bigIntToUnpaddedBytes(100000n), new Uint8Array(0)],
      [
        new Uint8Array([2]),
        new Uint8Array(0),
        bigIntToUnpaddedBytes(200000n),
        new Uint8Array([0x00]),
      ],
    ],
  }
  const tx = createFrameEIP8141Tx(txData, { common })

  const parsedFrames: ParsedFrame[] = [
    { mode: FRAME_MODE.VERIFY, target: sender, gasLimit: 100000n, data: new Uint8Array(0) },
    { mode: FRAME_MODE.SENDER, target: sender, gasLimit: 200000n, data: new Uint8Array([0x00]) },
  ]

  const state: FrameExecutionState = {
    parsedFrames,
    currentFrameIndex: 0,
    senderApproved: false,
    payerApproved: false,
    approveCalledInCurrentFrame: false,
    frameResults: [],
    totalGasCost: 5000000n,
    totalBlobGasCost: 0n,
  }

  evm.frameExecutionContext = { tx, state }

  const code = hexToBytes(
    '0x' +
      '60006000b0' + // TXPARAM(0x00, 0x00) -> tx type
      '60006001b0' + // TXPARAM(0x01, 0x00) -> nonce
      '60006009b0' + // TXPARAM(0x09, 0x00) -> frame count
      '00',
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

  evm.frameExecutionContext = undefined
}

main().catch(console.error)
