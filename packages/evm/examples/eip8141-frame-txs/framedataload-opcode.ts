/**
 * EIP-8141 FRAMEDATALOAD Opcode Example
 *
 * Demonstrates using the FRAMEDATALOAD opcode (0xb1) to read
 * 32-byte chunks from a specific frame's data within EVM execution.
 */

import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import { FRAME_MODE, type FrameTransactionContext, createEVM } from '@ethereumjs/evm'
import { Address, bytesToHex, hexToBytes } from '@ethereumjs/util'

async function main() {
  const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })
  const evm = await createEVM({ common })

  const sender = new Address(hexToBytes('0x' + 'ab'.repeat(20)))

  // 64 bytes of sample frame data
  const sampleData = hexToBytes(
    '0x' +
      'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' +
      'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
  )

  const ctx: FrameTransactionContext = {
    txType: 6,
    chainId: 1n,
    nonce: 0n,
    sender,
    maxPriorityFeePerGas: 0n,
    maxFeePerGas: 100n,
    maxFeePerBlobGas: 0n,
    blobVersionedHashes: [],
    sigHash: new Uint8Array(32),
    frames: [
      {
        mode: FRAME_MODE.DEFAULT,
        target: sender,
        gasLimit: 100000n,
        data: sampleData,
      },
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

  // Bytecode: PUSH1 <frameIdx>, PUSH1 <offset>, FRAMEDATALOAD
  // Read first 32 bytes from frame 0
  const code = hexToBytes(
    '0x' +
      '60006000b1' + // FRAMEDATALOAD(offset=0, frameIdx=0) → first 32 bytes
      '60006020b1' + // FRAMEDATALOAD(offset=32, frameIdx=0) → second 32 bytes
      '00', // STOP
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
  ;(evm as any).frameTransactionContext = undefined
}

main().catch(console.error)
