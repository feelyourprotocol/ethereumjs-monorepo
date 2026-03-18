/**
 * EIP-8141 APPROVE Opcode Example
 *
 * Demonstrates the APPROVE opcode (0xaa) which is the core
 * authorization mechanism of frame transactions. When called,
 * APPROVE increments the sender nonce and deducts the gas cost
 * from the sender/payer account.
 */

import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import {
  ENTRY_POINT_ADDRESS,
  FRAME_MODE,
  type FrameExecutionState,
  type ParsedFrame,
  createEVM,
} from '@ethereumjs/evm'
import { type FrameEIP8141TxData, createFrameEIP8141Tx } from '@ethereumjs/tx'
import { Account, Address, bigIntToUnpaddedBytes, hexToBytes } from '@ethereumjs/util'

async function main() {
  const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })
  const evm = await createEVM({ common })

  const senderHex = '0x' + 'ab'.repeat(20)
  const sender = new Address(hexToBytes(senderHex))
  const entryPoint = new Address(hexToBytes(ENTRY_POINT_ADDRESS))

  const initialBalance = 10n ** 18n
  await evm.stateManager.putAccount(sender, new Account(0n, initialBalance))

  const txData: FrameEIP8141TxData = {
    chainId: 1n,
    nonce: 0n,
    sender: senderHex as `0x${string}`,
    maxPriorityFeePerGas: 1n,
    maxFeePerGas: 50n,
    maxFeePerBlobGas: 0n,
    frames: [
      [new Uint8Array([1]), new Uint8Array(0), bigIntToUnpaddedBytes(100000n), new Uint8Array(0)],
    ],
  }
  const tx = createFrameEIP8141Tx(txData, { common })

  const parsedFrames: ParsedFrame[] = [
    { mode: FRAME_MODE.VERIFY, target: sender, gasLimit: 100000n, data: new Uint8Array(0) },
  ]

  const state: FrameExecutionState = {
    parsedFrames,
    currentFrameIndex: 0,
    senderApproved: false,
    payerApproved: false,
    approveCalledInCurrentFrame: false,
    frameResults: [],
    totalGasCost: 100000n * 50n,
    totalBlobGasCost: 0n,
  }

  evm.frameExecutionContext = { tx, state }

  const code = hexToBytes('0x6002aa')

  console.log('APPROVE opcode demonstration:')
  console.log('---')

  const accountBefore = await evm.stateManager.getAccount(sender)
  console.log(`  Sender balance before: ${accountBefore!.balance}`)
  console.log(`  Sender nonce before:   ${accountBefore!.nonce}`)

  const result = await evm.runCall({
    caller: entryPoint,
    to: sender,
    gasLimit: 100000n,
    code,
    data: new Uint8Array(0),
  })

  console.log()
  console.log(`  Gas used: ${result.execResult.executionGasUsed}`)
  console.log(`  Sender approved: ${state.senderApproved}`)
  console.log(`  Payer approved: ${state.payerApproved}`)
  console.log(`  APPROVE called: ${state.approveCalledInCurrentFrame}`)

  const accountAfter = await evm.stateManager.getAccount(sender)
  console.log()
  console.log(`  Sender balance after:  ${accountAfter!.balance}`)
  console.log(`  Sender nonce after:    ${accountAfter!.nonce}`)
  console.log(`  Balance deducted:      ${accountBefore!.balance - accountAfter!.balance}`)

  evm.frameExecutionContext = undefined
}

main().catch(console.error)
