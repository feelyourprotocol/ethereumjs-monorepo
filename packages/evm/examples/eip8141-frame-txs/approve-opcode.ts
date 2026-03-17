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
  type FrameTransactionContext,
  createEVM,
} from '@ethereumjs/evm'
import { Account, Address, hexToBytes } from '@ethereumjs/util'

async function main() {
  const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })
  const evm = await createEVM({ common })

  const sender = new Address(hexToBytes('0x' + 'ab'.repeat(20)))
  const entryPoint = new Address(hexToBytes(ENTRY_POINT_ADDRESS))

  // Fund the sender account
  const initialBalance = 10n ** 18n
  await evm.stateManager.putAccount(sender, new Account(0n, initialBalance))

  const ctx: FrameTransactionContext = {
    txType: 6,
    chainId: 1n,
    nonce: 0n,
    sender,
    maxPriorityFeePerGas: 1n,
    maxFeePerGas: 50n,
    maxFeePerBlobGas: 0n,
    blobVersionedHashes: [],
    sigHash: new Uint8Array(32),
    frames: [
      {
        mode: FRAME_MODE.VERIFY,
        target: sender,
        gasLimit: 100000n,
        data: new Uint8Array(0),
      },
    ],
    currentFrameIndex: 0,
    senderApproved: false,
    payerApproved: false,
    approveCalledInCurrentFrame: false,
    frameResults: [],
    totalGasCost: 100000n * 50n,
    totalBlobGasCost: 0n,
  }
  ;(evm as any).frameTransactionContext = ctx

  // Bytecode: PUSH1 0x02, APPROVE (scope 2 = approve both sender and payer)
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
  console.log(`  Sender approved: ${ctx.senderApproved}`)
  console.log(`  Payer approved: ${ctx.payerApproved}`)
  console.log(`  APPROVE called: ${ctx.approveCalledInCurrentFrame}`)

  const accountAfter = await evm.stateManager.getAccount(sender)
  console.log()
  console.log(`  Sender balance after:  ${accountAfter!.balance}`)
  console.log(`  Sender nonce after:    ${accountAfter!.nonce}`)
  console.log(`  Balance deducted:      ${accountBefore!.balance - accountAfter!.balance}`)
  ;(evm as any).frameTransactionContext = undefined
}

main().catch(console.error)
