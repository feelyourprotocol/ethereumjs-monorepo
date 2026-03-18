/**
 * EIP-8141 FRAMEDATALOAD Opcode Example
 *
 * Demonstrates using the FRAMEDATALOAD opcode (0xb1) to read
 * 32-byte chunks from a specific frame's data within EVM execution.
 */

import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import { FRAME_MODE, type FrameExecutionState, type ParsedFrame, createEVM } from '@ethereumjs/evm'
import { type FrameEIP8141TxData, createFrameEIP8141Tx } from '@ethereumjs/tx'
import { Address, bigIntToUnpaddedBytes, bytesToHex, hexToBytes } from '@ethereumjs/util'

async function main() {
  const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })
  const evm = await createEVM({ common })

  const senderHex = '0x' + 'ab'.repeat(20)
  const sender = new Address(hexToBytes(senderHex))

  const sampleData = hexToBytes(
    '0x' +
      'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' +
      'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
  )

  const txData: FrameEIP8141TxData = {
    chainId: 1n,
    nonce: 0n,
    sender: senderHex as `0x${string}`,
    maxPriorityFeePerGas: 0n,
    maxFeePerGas: 100n,
    maxFeePerBlobGas: 0n,
    frames: [[new Uint8Array([0]), new Uint8Array(0), bigIntToUnpaddedBytes(100000n), sampleData]],
  }
  const tx = createFrameEIP8141Tx(txData, { common })

  const parsedFrames: ParsedFrame[] = [
    { mode: FRAME_MODE.DEFAULT, target: sender, gasLimit: 100000n, data: sampleData },
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
      '60006000b1' + // FRAMEDATALOAD(offset=0, frameIdx=0) -> first 32 bytes
      '60006020b1' + // FRAMEDATALOAD(offset=32, frameIdx=0) -> second 32 bytes
      '00',
  )

  const result = await evm.runCode!({ code, gasLimit: 100000n })

  console.log('FRAMEDATALOAD opcode demonstration:')
  console.log('---')

  const stack = result.runState!.stack
  const second = stack.pop()
  const first = stack.pop()

  console.log(`  Frame data[0:32]:  0x${first!.toString(16).padStart(64, '0')}`)
  console.log(`  Frame data[32:64]: 0x${second!.toString(16).padStart(64, '0')}`)
  console.log(`  Gas used: ${result.executionGasUsed}`)
  console.log()
  console.log(`  Original data: ${bytesToHex(sampleData)}`)

  evm.frameExecutionContext = undefined
}

main().catch(console.error)
